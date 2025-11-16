import cors from "cors";
import express from "express";
import {
  Claim,
  Credential,
  Operation,
  Presentation,
  PresentationRequest,
  PresentationSpec
} from "mina-attestations";
import { Bool, Field, PrivateKey, UInt64 } from "o1js";
import { badgeCatalog, demoIdentity } from "../../shared/badge-catalog.js";
import { IdentityCredential, MILLIS_PER_YEAR, Strings } from "../../shared/identity-schema.js";

const app = express();
app.use(cors());
app.use(express.json());

type BadgeRule =
  | { type: "age"; minYears: number }
  | { type: "nationality"; allowed?: string[]; disallowed?: string[] }
  | { type: "residency"; allowed?: string[]; disallowed?: string[] }
  | { type: "kyc-tier"; minTier: number }
  | { type: "sanctions-clear" }
  | { type: "email-verified" }
  | { type: "email-domain"; allowedDomains: string[] }
  | { type: "unique-hash" };

type BadgeMeta = {
  id: string;
  label: string;
  description: string;
  icon: string;
  tone?: string;
  rules: BadgeRule[];
};

type StoredRequest = {
  badgeId: string;
  request: ReturnType<typeof PresentationRequest.https>;
  origin: string;
  createdAt: number;
};

const issuerPrivateKey = PrivateKey.fromBase58(
  process.env.MINA_BADGE_ISSUER_PK ?? "EKEg9DJQBhB8W49Wgf9hZrPetk2cYPXhhLxDUkAwvh5cxUAFLnqy"
);
const issuerPublicKey = issuerPrivateKey.toPublicKey();
const issuerHash = Credential.Native.issuer(issuerPublicKey);
const uniqueHashField = Field(demoIdentity.uniqueHash);

const badgeMap = new Map<string, BadgeMeta>(
  badgeCatalog.map((item) => [item.id, item as BadgeMeta])
);

const compiledSpecs = new Map<string, Awaited<ReturnType<typeof Presentation.precompile>>>();
const requestStore = new Map<string, StoredRequest>();
const REQUEST_TTL_MS = 5 * 60 * 1000;

app.get("/badges", (_req, res) => {
  res.json(
    badgeCatalog.map((badge) => ({
      id: badge.id,
      label: badge.label,
      description: badge.description,
      icon: badge.icon,
      tone: badge.tone
    }))
  );
});

app.post("/presentation-request", async (req, res) => {
  const { badgeType, origin } = req.body ?? {};
  const badge = typeof badgeType === "string" ? badgeMap.get(badgeType) : undefined;
  if (!badge) {
    return res.status(400).json({ success: false, reason: "Unknown badge type" });
  }

  try {
    const compiled = await getCompiledSpec(badge.id, badge.rules);
    const claims = { createdAt: UInt64.from(Date.now()) };
    const request = PresentationRequest.httpsFromCompiled(compiled, claims, {
      action: `minabadges:badge:${badge.id}`
    });
    const requestId = request.inputContext?.serverNonce.toString();
    if (!requestId) {
      throw new Error("Request nonce missing");
    }
    const expectedOrigin = typeof origin === "string" ? origin : "http://localhost:5173";
    requestStore.set(requestId, {
      badgeId: badge.id,
      request,
      origin: expectedOrigin,
      createdAt: Date.now()
    });
    res.json({
      success: true,
      badgeType: badge.id,
      requestId,
      requestJson: PresentationRequest.toJSON(request),
      expiresAt: Date.now() + REQUEST_TTL_MS
    });
  } catch (error) {
    console.error("Failed to create presentation request:", error);
    res.status(500).json({ success: false, reason: "Failed to create request" });
  }
});

app.post("/verify-presentation", async (req, res) => {
  const { badgeType, presentationJson, requestId, origin } = req.body ?? {};
  if (typeof requestId !== "string" || typeof presentationJson !== "string") {
    return res.status(400).json({ success: false, reason: "Invalid payload" });
  }
  const stored = requestStore.get(requestId);
  if (!stored) {
    return res.status(410).json({ success: false, reason: "Request expired or unknown" });
  }
  if (stored.badgeId !== badgeType) {
    return res.status(400).json({ success: false, reason: "Badge mismatch" });
  }

  const verifierOrigin =
    typeof origin === "string" ? origin : stored.origin ?? "http://localhost:5173";

  try {
    const presentation = Presentation.fromJSON(presentationJson);
    const output = await Presentation.verify(stored.request, presentation, {
      verifierIdentity: verifierOrigin
    });
    requestStore.delete(requestId);
    cleanupExpiredRequests();
    res.json({
      success: true,
      badgeType,
      issuer: output.toString()
    });
  } catch (error) {
    console.error("Verification failed:", error);
    res.status(400).json({
      success: false,
      badgeType,
      reason: error instanceof Error ? error.message : "Unknown verification error"
    });
  }
});

app.listen(4000, () => {
  console.log("HTTPZ Backend running on http://localhost:4000");
});

async function getCompiledSpec(badgeId: string, rules: BadgeRule[]) {
  const cached = compiledSpecs.get(badgeId);
  if (cached) {
    return cached;
  }
  const spec = PresentationSpec(
    { credential: IdentityCredential, createdAt: Claim(UInt64) },
    ({ credential, createdAt }) => {
      const assertions = [
        Operation.equals(Operation.issuer(credential), Operation.constant(issuerHash)),
        ...rules.map((rule) => buildRuleAssertion(rule, credential, createdAt))
      ].filter(Boolean);

      return {
        assert: assertions as any,
        outputClaim: Operation.issuer(credential)
      };
    }
  );
  const compiled = await Presentation.precompile(spec);
  compiledSpecs.set(badgeId, compiled);
  return compiled;
}

function buildRuleAssertion(rule: BadgeRule, credential: any, createdAt: any) {
  switch (rule.type) {
    case "age": {
      const thresholdMs = MILLIS_PER_YEAR * BigInt(rule.minYears);
      const minApprovedBirth = Operation.sub(
        createdAt,
        Operation.constant(UInt64.from(thresholdMs))
      );
      return Operation.lessThanEq(
        Operation.property(credential, "dateOfBirthMs"),
        minApprovedBirth
      );
    }
    case "nationality":
      return handleCountryRule(Operation.property(credential, "nationality"), rule);
    case "residency":
      return handleCountryRule(Operation.property(credential, "residency"), rule);
    case "kyc-tier":
      return Operation.lessThanEq(
        Operation.constant(UInt64.from(rule.minTier)),
        Operation.property(credential, "kycTier")
      );
    case "sanctions-clear":
      return Operation.equals(
        Operation.property(credential, "sanctionsCleared"),
        Operation.constant(Bool(true))
      );
    case "email-verified":
      return Operation.equals(
        Operation.property(credential, "emailVerified"),
        Operation.constant(Bool(true))
      );
    case "email-domain":
      return handleStringListRule(
        Operation.property(credential, "emailDomain"),
        rule.allowedDomains,
        Strings.domain
      );
    case "unique-hash":
      return Operation.equals(
        Operation.property(credential, "uniqueHash"),
        Operation.constant(uniqueHashField)
      );
    default:
      throw new Error(`Unsupported rule: ${(rule as { type: string }).type}`);
  }
}

function handleCountryRule(node: any, rule: { allowed?: string[]; disallowed?: string[] }) {
  if (rule.allowed && rule.allowed.length > 0) {
    return handleStringListRule(node, rule.allowed, Strings.country);
  }
  if (rule.disallowed && rule.disallowed.length > 0) {
    const blocked = handleStringListRule(node, rule.disallowed, Strings.country);
    return Operation.not(blocked);
  }
  throw new Error("Country rule missing configuration");
}

function handleStringListRule(node: any, values: string[], schema: any) {
  if (!values.length) {
    throw new Error("String list cannot be empty");
  }
  const equalsOps = values.map((value) =>
    Operation.equals(node, Operation.constant(schema.from(value)))
  );
  return foldOr(equalsOps);
}

function foldOr(nodes: any[]) {
  return nodes.reduce((prev, current) => {
    if (!prev) return current;
    return Operation.or(prev, current);
  });
}

function cleanupExpiredRequests() {
  const now = Date.now();
  for (const [key, entry] of requestStore.entries()) {
    if (now - entry.createdAt > REQUEST_TTL_MS) {
      requestStore.delete(key);
    }
  }
}
