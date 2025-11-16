import { Credential, Presentation, PresentationRequest } from "mina-attestations";
import { Bool, Field, PrivateKey, UInt64, initializeBindings } from "o1js";
import {
  DEMO_ISSUER_PRIVATE_KEY,
  DEMO_OWNER_PRIVATE_KEY,
  demoIdentity
} from "@shared/badge-catalog.js";
import { Strings } from "@shared/identity-schema.js";

const walletReady = (async () => {
  await initializeBindings();
  const ownerKey = PrivateKey.fromBase58(DEMO_OWNER_PRIVATE_KEY);
  const issuerKey = PrivateKey.fromBase58(DEMO_ISSUER_PRIVATE_KEY);
  const credential = Credential.sign(issuerKey, {
    owner: ownerKey.toPublicKey(),
    data: {
      fullName: Strings.name.from(demoIdentity.fullName),
      nationality: Strings.country.from(demoIdentity.nationality),
      residency: Strings.country.from(demoIdentity.residency),
      dateOfBirthMs: UInt64.from(demoIdentity.dateOfBirthMs),
      kycTier: UInt64.from(demoIdentity.kycTier),
      sanctionsCleared: Bool(demoIdentity.sanctionsCleared),
      emailDomain: Strings.domain.from(demoIdentity.emailDomain),
      emailVerified: Bool(demoIdentity.emailVerified),
      uniqueHash: Field(demoIdentity.uniqueHash)
    }
  });
  await Credential.validate(credential);
  return { ownerKey, credential };
})();

export async function createPresentationPayload(requestJson, origin) {
  const { ownerKey, credential } = await walletReady;
  const request = PresentationRequest.fromJSON("https", requestJson);
  const presentation = await Presentation.create(ownerKey, {
    request,
    credentials: [credential],
    context: { verifierIdentity: origin }
  });
  return Presentation.toJSON(presentation);
}

export async function getSampleCredentialJSON() {
  const { credential } = await walletReady;
  return Credential.toJSON(credential);
}
