import { createPresentationPayload } from "./wallet-sim.js";

const BACKEND_URL = "http://localhost:4000";

const stageMessages = {
  request: "Building presentation request",
  wallet: "Wallet constructing proof",
  verify: "Verifier checking presentation",
  success: "Badge verified"
};

function logStatus(callback, stage, payload) {
  if (!callback) return;
  callback({ stage, message: stageMessages[stage] ?? stage, payload });
}

async function fetchJSON(path, options) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.reason || `Request failed (${response.status})`);
  }
  return response.json();
}

async function getCatalog() {
  return fetchJSON("/badges");
}

async function requestPresentation(badgeType) {
  return fetchJSON("/presentation-request", {
    method: "POST",
    body: JSON.stringify({ badgeType, origin: window.location.origin })
  });
}

async function sendPresentation(payload) {
  return fetchJSON("/verify-presentation", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function verifyBadge({ badgeType, onStatus }) {
  try {
    logStatus(onStatus, "request");
    const request = await requestPresentation(badgeType);

    logStatus(onStatus, "wallet");
    const presentationJson = await createPresentationPayload(
      request.requestJson,
      window.location.origin
    );

    logStatus(onStatus, "verify");
    const verification = await sendPresentation({
      badgeType,
      requestId: request.requestId,
      presentationJson,
      origin: window.location.origin
    });

    logStatus(onStatus, "success", verification);
    return verification;
  } catch (error) {
    if (onStatus) {
      onStatus({ stage: "error", message: error.message, error });
    }
    throw error;
  }
}

const HttpzBadgeKit = {
  listBadges: getCatalog,
  verify: verifyBadge
};

window.HttpzBadgeKit = HttpzBadgeKit;
export default HttpzBadgeKit;
