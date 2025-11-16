import { createPresentationPayload, getSampleCredentialJSON } from "./wallet-sim.js";

const state = {
  provider: null,
  providerInfo: null,
  available: false,
  connected: false,
  mode: "mock",
  accounts: [],
  lastError: null
};

const subscribers = new Set();

function notify() {
  const snapshot = getState();
  subscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (error) {
      console.error("walletBridge subscriber failed", error);
    }
  });
}

function getState() {
  return {
    providerInfo: state.providerInfo,
    available: state.available,
    connected: state.connected,
    mode: state.mode,
    accounts: state.accounts.slice(),
    lastError: state.lastError
  };
}

export const walletBridge = {
  subscribe(callback) {
    subscribers.add(callback);
    callback(getState());
    return () => subscribers.delete(callback);
  },

  getState,

  usingWallet() {
    return state.mode === "wallet" && state.connected && !!state.provider;
  },

  hasProvider() {
    return state.available;
  },

  useMockWallet() {
    state.mode = "mock";
    notify();
  },

  async connectWallet() {
    const adapter = await ensureProvider();
    const accounts = await callProvider(adapter, {
      method: "mina_requestAccounts",
      params: []
    });
    if (Array.isArray(accounts) && accounts.length > 0) {
      state.connected = true;
      state.mode = "wallet";
      state.accounts = accounts;
    } else {
      state.connected = false;
      state.accounts = [];
      state.mode = "mock";
    }
    notify();
    return accounts;
  },

  async installSampleCredential() {
    const adapter = await ensureProvider(true);
    const credentialJson = await getSampleCredentialJSON();
    const payload = JSON.parse(credentialJson);
    return callProvider(adapter, {
      method: "mina_storePrivateCredential",
      params: [payload]
    });
  },

  async createPresentation(requestJson, origin) {
    if (this.usingWallet()) {
      const adapter = await ensureProvider(true);
      const params = [
        {
          presentationRequest: JSON.parse(requestJson)
        }
      ];
      const result = await callProvider(adapter, {
        method: "mina_requestPresentation",
        params
      });
      if (typeof result === "string") {
        return result;
      }
      if (result && typeof result === "object") {
        if (typeof result.presentationJson === "string") {
          return result.presentationJson;
        }
        if (typeof result.credential === "string") {
          return result.credential;
        }
      }
      throw new Error("Wallet returned unexpected presentation payload");
    }
    return createPresentationPayload(requestJson, origin);
  }
};

function ensureWindowProvider() {
  if (typeof window === "undefined") {
    return;
  }
  if (window.mina && !state.provider) {
    registerProvider({
      provider: window.mina,
      info: window.mina?.walletType
        ? { name: window.mina.walletType, slug: window.mina.walletType }
        : { name: "Injected Mina Wallet", slug: "inject" }
    });
  }
}

function setupAnnouncements() {
  if (typeof window === "undefined") {
    return;
  }
  window.addEventListener("mina:announceProvider", (event) => {
    const detail = event?.detail;
    if (detail?.provider) {
      registerProvider(detail);
    }
  });
  try {
    window.dispatchEvent(new Event("mina:requestProvider"));
  } catch (err) {
    console.warn("Unable to request mina provider", err);
  }
}

async function ensureProvider(requireExisting = false) {
  if (state.provider) {
    return state.provider;
  }
  if (!requireExisting) {
    ensureWindowProvider();
  }
  if (state.provider) {
    return state.provider;
  }
  await waitForProvider();
  if (!state.provider) {
    throw new Error("Mina wallet provider not detected");
  }
  return state.provider;
}

function registerProvider(candidate) {
  if (!candidate) return;
  const adapter = wrapProvider(candidate);
  if (!adapter) return;
  state.provider = adapter;
  state.providerInfo = adapter.info;
  state.available = true;
  notify();
  refreshAccounts(adapter);
}

async function waitForProvider() {
  ensureWindowProvider();
  if (state.provider) return;
  setupAnnouncements();
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function refreshAccounts(adapter) {
  try {
    const accounts = await callProvider(adapter, {
      method: "mina_accounts",
      params: []
    });
    if (Array.isArray(accounts) && accounts.length) {
      state.accounts = accounts;
      state.connected = true;
      state.mode = "wallet";
      notify();
    }
  } catch (err) {
    // ignore if wallet doesn't implement mina_accounts
  }
}

function wrapProvider(entry) {
  const raw = entry.provider ?? entry;
  if (!raw) return null;
  const info = entry.info ?? {
    name: raw?.name ?? "Mina Wallet",
    slug: entry.slug ?? "wallet"
  };
  const supportsRequest = typeof raw.request === "function";
  return {
    info,
    request(payload) {
      if (supportsRequest) {
        return raw.request(payload);
      }
      return callDirect(raw, payload);
    }
  };
}

const DIRECT_METHODS = {
  mina_requestAccounts: "requestAccounts",
  mina_accounts: "accounts",
  mina_storePrivateCredential: "storePrivateCredential",
  mina_requestPresentation: "requestPresentation"
};

async function callDirect(raw, payload) {
  const fnName = DIRECT_METHODS[payload.method];
  const fn = raw[fnName];
  if (typeof fn !== "function") {
    throw new Error(`Wallet provider missing method ${payload.method}`);
  }
  const params = payload.params ?? [];
  return fn.apply(raw, params);
}

async function callProvider(adapter, payload) {
  try {
    const response = await adapter.request(payload);
    let normalized = response;
    if (response && typeof response === "object") {
      if ("error" in response && response.error) {
        throw new Error(response.error.message || "Wallet error");
      }
      if ("result" in response) {
        normalized = response.result;
      }
    }
    if (state.lastError) {
      state.lastError = null;
      notify();
    }
    return normalized;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    notify();
    throw error;
  }
}

ensureWindowProvider();
setupAnnouncements();

export default walletBridge;
