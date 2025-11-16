import HttpzBadgeKit from "./badge-sdk.js";
import { createElement, icons } from "lucide";

document.addEventListener("DOMContentLoaded", () => {
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
