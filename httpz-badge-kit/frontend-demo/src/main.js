import HttpzBadgeKit from "./badge-sdk.js";
import walletBridge from "./wallet-provider.js";
import { createElement, icons } from "lucide";

let lastWalletState = null;
let walletNoteOverride = null;
let walletNoteTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  setupWalletPanel();
  bootstrap();
});

async function bootstrap() {
  const grid = document.getElementById("badge-grid");
  const log = document.getElementById("activity-log");
  log.textContent = "Loading badge catalog...";

  try {
    const badges = await HttpzBadgeKit.listBadges();
    log.textContent = "Select a badge to start the flow.";
    badges.forEach((badge) => {
      const card = buildBadgeCard(badge);
      grid.appendChild(card);
    });
  } catch (error) {
    log.textContent = `Failed to load badges: ${error.message}`;
  }
}

function setupWalletPanel() {
  const connectBtn = document.getElementById("wallet-connect");
  const installBtn = document.getElementById("wallet-install");

  if (!connectBtn || !installBtn) {
    return;
  }

  connectBtn.addEventListener("click", async () => {
    connectBtn.disabled = true;
    try {
      await walletBridge.connectWallet();
      setWalletNote("Wallet connected", 4000);
    } catch (error) {
      console.error("Wallet connect failed", error);
      setWalletNote(error.message || "Failed to connect wallet", 6000);
    } finally {
      connectBtn.disabled = false;
    }
  });

  installBtn.addEventListener("click", async () => {
    installBtn.disabled = true;
    try {
      await walletBridge.installSampleCredential();
      setWalletNote("Sample credential stored in wallet", 5000);
    } catch (error) {
      console.error("Failed to store credential", error);
      setWalletNote(error.message || "Failed to store credential", 6000);
    } finally {
      installBtn.disabled = false;
    }
  });

  walletBridge.subscribe((state) => {
    lastWalletState = state;
    renderWalletState(state);
    connectBtn.disabled = !state.available || state.connected;
    installBtn.disabled = !(state.mode === "wallet" && state.connected);
  });
}

function renderWalletState(state) {
  const statusEl = document.getElementById("wallet-status");
  const noteEl = document.getElementById("wallet-note");
  if (!statusEl || !noteEl) {
    return;
  }
  const providerName = state.providerInfo?.name ?? "Wallet";
  if (state.mode === "wallet" && state.connected) {
    statusEl.textContent = `${providerName} connected`;
    const account = state.accounts[0];
    const baseNote = account ? `Using ${shortPublicKey(account)} for proofs.` : "Ready to prove badges.";
    noteEl.textContent = walletNoteOverride ?? state.lastError ?? baseNote;
    return;
  }
  if (state.available) {
    statusEl.textContent = "Wallet detected";
    const baseNote =
      "Connect to run proofs through your wallet, or stay on the built-in mock wallet.";
    noteEl.textContent = walletNoteOverride ?? state.lastError ?? baseNote;
    return;
  }
  statusEl.textContent = "Mock wallet active";
  noteEl.textContent =
    walletNoteOverride ??
    "Install Auro or Pallad to try real wallets. The mock wallet stays ready.";
}

function setWalletNote(message, ttl = 5000) {
  walletNoteOverride = message;
  clearTimeout(walletNoteTimer);
  walletNoteTimer = window.setTimeout(() => {
    walletNoteOverride = null;
    if (lastWalletState) {
      renderWalletState(lastWalletState);
    }
  }, ttl);
  if (lastWalletState) {
    renderWalletState(lastWalletState);
  }
}

function buildBadgeCard(badge) {
  const card = document.createElement("article");
  card.className = "badge-card";
  card.dataset.badge = badge.id;
  card.dataset.label = badge.label;
  card.innerHTML = `
    <div class="badge-meta">
      <div class="badge-icon">${renderIcon(badge.icon)}</div>
      <div>
        <h3>${badge.label}</h3>
        <div class="badge-status">Idle</div>
      </div>
    </div>
    <p class="badge-desc">${badge.description}</p>
    <div class="badge-actions">
      <button type="button">Verify</button>
    </div>
  `;

  const button = card.querySelector("button");
  const statusEl = card.querySelector(".badge-status");
  const log = document.getElementById("activity-log");

  const pushLog = (message) => {
    const stamp = new Date().toLocaleTimeString();
    const entry = `[${stamp}] ${badge.label} - ${message}`;
    log.textContent = `${entry}\n${log.textContent}`.trim();
  };

  button.addEventListener("click", async () => {
    if (card.dataset.loading === "true") return;
    card.dataset.loading = "true";
    button.disabled = true;
    setStatus(statusEl, "Requesting presentation...");
    pushLog("Requesting presentation");

    try {
      await HttpzBadgeKit.verify({
        badgeType: badge.id,
        onStatus: ({ stage, message }) => {
          setStatus(statusEl, message);
          pushLog(message);
        }
      });
      card.dataset.state = "verified";
      setStatus(statusEl, "Verified ?");
      pushLog("Verified");
    } catch (error) {
      card.dataset.state = "error";
      const msg = `Failed: ${error.message}`;
      setStatus(statusEl, msg);
      pushLog(msg);
    } finally {
      button.disabled = false;
      card.dataset.loading = "false";
    }
  });

  return card;
}

function setStatus(target, message) {
  if (target) {
    target.textContent = message;
  }
}

function renderIcon(name) {
  const iconNode = icons[name];
  if (!iconNode) {
    return `<svg viewBox="0 0 24 24" stroke="currentColor" fill="none"><circle cx="12" cy="12" r="9" /></svg>`;
  }
  const svg = createElement(iconNode);
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke-width", "1.5");
  return svg.outerHTML;
}

function shortPublicKey(key) {
  if (typeof key !== "string" || key.length < 10) {
    return key;
  }
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
