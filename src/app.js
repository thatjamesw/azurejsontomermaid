import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
import "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.1.4/dist/mermaid-layout-elk.esm.min.mjs";
import { buildGraph, projectView } from "./core/graph.js";
import { normalizePayloads } from "./core/normalize.js";
import { escapeHtml } from "./core/arm.js";
import { renderMermaid } from "./render/mermaid.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  inputs: [],
  resources: [],
  errors: [],
  graph: null,
  viewGraph: null,
  mermaid: "",
  selectedId: "",
  breakdown: {
    providers: [],
    types: [],
  },
};

function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "default",
    flowchart: {
      defaultRenderer: "elk",
      htmlLabels: true,
      useMaxWidth: false,
      nodeSpacing: 50,
      rankSpacing: 90,
      curve: "basis",
    },
  });
}

async function loadInputs() {
  const files = Array.from($("#file-input").files || []);
  const fileEntries = await Promise.all(files.map(async (file) => ({
    name: file.name,
    text: await file.text(),
  })));

  const pasted = ($("#json-input").value || "").trim();
  const inputs = [...fileEntries];
  if (pasted) {
    inputs.push({ name: "Pasted JSON", text: pasted });
  }
  return inputs;
}

function currentOptions() {
  return {
    view: $("#view-select").value,
    layout: $("#layout-select").value,
    grouping: $("#group-select").value,
    includeInferred: $("#inferred-toggle").checked,
    includeContainment: $("#containment-toggle").checked,
  };
}

function summarizeCounts(items) {
  return Object.entries(items.reduce((accumulator, item) => {
    accumulator[item] = (accumulator[item] || 0) + 1;
    return accumulator;
  }, {}))
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10);
}

function updateSummaries() {
  const fileNames = state.inputs.map((item) => item.name);
  $("#file-summary").textContent = fileNames.length
    ? `${fileNames.length} input${fileNames.length === 1 ? "" : "s"} loaded: ${fileNames.join(", ")}`
    : "No files selected.";

  if (state.errors.length) {
  } else if (state.resources.length) {
  }

  const stats = state.graph?.stats || {
    files: 0,
    resources: 0,
    subscriptions: 0,
    resourceGroups: 0,
    providers: 0,
    resourceTypes: 0,
  };
  $("#metric-files").textContent = String(stats.files || state.inputs.length || 0);
  $("#metric-resources").textContent = String(stats.resources || 0);
  $("#metric-subscriptions").textContent = String(stats.subscriptions || 0);
  $("#metric-groups").textContent = String(stats.resourceGroups || 0);
  $("#metric-nodes").textContent = String(state.viewGraph?.nodes.length || 0);
  $("#metric-edges").textContent = String(state.viewGraph?.edges.length || 0);
  $("#metric-providers").textContent = String(stats.providers || 0);
  $("#metric-types").textContent = String(stats.resourceTypes || 0);
}

function updateStatus(message, tone = "info") {
  const banner = $("#status-banner");
  if (!banner) {
    return;
  }
  banner.textContent = message;
  banner.dataset.tone = tone;
}

function renderCoverage() {
  const providerRows = state.breakdown.providers.length
    ? state.breakdown.providers.map(([name, count]) => `<tr><th>${escapeHtml(name)}</th><td>${count}</td></tr>`).join("")
    : '<tr><th>No provider data yet</th><td>0</td></tr>';
  const typeRows = state.breakdown.types.length
    ? state.breakdown.types.map(([name, count]) => `<tr><th>${escapeHtml(name)}</th><td>${count}</td></tr>`).join("")
    : '<tr><th>No type data yet</th><td>0</td></tr>';

  $("#provider-breakdown").innerHTML = providerRows;
  $("#type-breakdown").innerHTML = typeRows;
}

function renderInventory() {
  const inventory = $("#inventory");
  inventory.innerHTML = "";

  if (!state.graph?.nodes?.length) {
    inventory.innerHTML = '<p class="inventory-empty">No topology inventory yet.</p>';
    return;
  }

  const filterText = ($("#search-input").value || "").trim().toLowerCase();
  const items = state.graph.nodes
    .filter((node) => !node.synthetic)
    .filter((node) => {
      if (!filterText) {
        return true;
      }
      const haystack = [
        node.name,
        node.type,
        node.kind,
        node.serviceFamily,
        node.resourceGroup,
        node.subscriptionId,
      ].join(" ").toLowerCase();
      return haystack.includes(filterText);
    })
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 250);

  if (!items.length) {
    inventory.innerHTML = '<p class="inventory-empty">No resources match the current filter.</p>';
    return;
  }

  items.forEach((node) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-item${state.selectedId === node.id ? " is-active" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(node.name)}</strong>
      <span>${escapeHtml(node.serviceLabel || node.type)}</span>
      <span>${escapeHtml(node.resourceGroup || "")}</span>
    `;
    button.addEventListener("click", () => {
      state.selectedId = node.id;
      renderInventory();
      renderDetail();
    });
    inventory.appendChild(button);
  });
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "Not set";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function renderDefinitionList(items) {
  const rows = items
    .filter((item) => item.value !== undefined && item.value !== null && item.value !== "")
    .map((item) => `
      <div class="detail-grid-row">
        <dt>${escapeHtml(item.label)}</dt>
        <dd>${escapeHtml(formatDetailValue(item.value))}</dd>
      </div>
    `)
    .join("");

  return rows ? `<dl class="detail-grid">${rows}</dl>` : '<div class="detail-meta">No additional metadata available.</div>';
}

function renderDetail() {
  const detail = $("#detail");
  const node = state.graph?.nodes?.find((item) => item.id === state.selectedId);

  if (!node) {
    detail.innerHTML = '<p class="detail-empty">Select a resource from the inventory to inspect its metadata and relationships.</p>';
    return;
  }

  const edges = state.graph.edges.filter((edge) => edge.source === node.id || edge.target === node.id);
  const connected = edges.map((edge) => {
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const other = state.graph.nodes.find((item) => item.id === otherId);
    return other ? `${edge.relation}: ${other.name}` : `${edge.relation}: ${otherId}`;
  });

  const metadataKeys = Object.keys(node.metadata || {}).filter((key) => key !== "properties").slice(0, 10);
  const tags = node.metadata?.tags && typeof node.metadata.tags === "object"
    ? Object.entries(node.metadata.tags)
    : [];
  const importantFields = [
    { label: "Location", value: node.metadata?.location },
    { label: "Original kind", value: node.metadata?.kind },
    { label: "SKU", value: node.metadata?.sku?.name || node.metadata?.sku },
    { label: "SKU tier", value: node.metadata?.sku?.tier },
    { label: "Managed by", value: node.metadata?.managedBy },
    { label: "Zones", value: node.metadata?.zones },
    { label: "Identity type", value: node.metadata?.identity?.type },
    { label: "Plan", value: node.metadata?.plan?.name || node.metadata?.plan },
    { label: "Extended location", value: node.metadata?.extendedLocation?.name || node.metadata?.extendedLocation?.type },
    { label: "Provisioning state", value: node.metadata?.properties?.provisioningState },
  ];
  const rawMetadata = JSON.stringify(node.metadata || {}, null, 2);

  detail.innerHTML = `
    <h4>${escapeHtml(node.name)}</h4>
    <div class="detail-meta">${escapeHtml(node.type)}</div>
    <div class="detail-block">
      <strong>Identity</strong>
      <ul class="detail-list">
        <li>Kind: ${escapeHtml(node.kind)}</li>
        <li>Service family: ${escapeHtml(node.serviceFamily || "resource")}</li>
        <li>Provider: ${escapeHtml(node.providerNamespace || "unknown")}</li>
        <li>Subscription: ${escapeHtml(node.subscriptionId || "unknown")}</li>
        <li>Resource group: ${escapeHtml(node.resourceGroup || "unknown")}</li>
        <li>Source: ${escapeHtml(node.sourceName || "session")}</li>
      </ul>
    </div>
    <div class="detail-block">
      <strong>ARM ID</strong>
      <div class="detail-meta">${escapeHtml(node.armId || "Synthetic node")}</div>
    </div>
    <div class="detail-block">
      <strong>Resource details</strong>
      ${renderDefinitionList(importantFields)}
    </div>
    <div class="detail-block">
      <strong>Tags</strong>
      ${tags.length
        ? `<dl class="detail-grid">${tags.map(([key, value]) => `
            <div class="detail-grid-row">
              <dt>${escapeHtml(key)}</dt>
              <dd>${escapeHtml(formatDetailValue(value))}</dd>
            </div>
          `).join("")}</dl>`
        : '<div class="detail-meta">No tags on this resource.</div>'}
    </div>
    <div class="detail-block">
      <strong>Relationships</strong>
      ${connected.length ? `<ul class="detail-list">${connected.slice(0, 12).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<div class="detail-meta">No related nodes in the current graph.</div>'}
    </div>
    <div class="detail-block">
      <strong>Metadata keys</strong>
      ${metadataKeys.length ? `<ul class="detail-list">${metadataKeys.map((key) => `<li>${escapeHtml(key)}</li>`).join("")}</ul>` : '<div class="detail-meta">No top-level metadata keys available.</div>'}
    </div>
    <div class="detail-block">
      <details class="detail-json">
        <summary>Full resource JSON</summary>
        <pre>${escapeHtml(rawMetadata)}</pre>
      </details>
    </div>
  `;
}

async function renderDiagram() {
  const shell = $("#diagram");
  shell.textContent = "Rendering topology...";
  try {
    const renderId = `mermaid-${Math.random().toString(36).slice(2)}`;
    const { svg } = await mermaid.render(renderId, state.mermaid);
    shell.innerHTML = svg;
  } catch (error) {
    shell.textContent = `Mermaid render failed: ${error.message}`;
  }
}

async function rebuild() {
  state.inputs = await loadInputs();
  const normalized = normalizePayloads(state.inputs);
  state.resources = normalized.resources;
  state.errors = normalized.errors;

  if (!state.inputs.length) {
    state.graph = null;
    state.viewGraph = null;
    state.mermaid = "";
    state.selectedId = "";
    state.breakdown = { providers: [], types: [] };
    $("#diagram").textContent = "Build a topology view to render the diagram.";
    $("#mermaid-output").value = "";
    updateSummaries();
    updateStatus("Load Azure JSON and build the topology to begin.");
    renderInventory();
    renderDetail();
    renderCoverage();
    return;
  }

  if (!state.resources.length) {
    state.graph = null;
    state.viewGraph = null;
    state.mermaid = "";
    state.breakdown = { providers: [], types: [] };
    $("#diagram").textContent = "No resources were found in the supplied JSON.";
    $("#mermaid-output").value = "";
    updateSummaries();
    updateStatus("The current inputs parsed, but no Azure resource objects were discovered.", "warning");
    renderInventory();
    renderDetail();
    renderCoverage();
    return;
  }

  state.graph = buildGraph(state.resources, currentOptions());
  state.viewGraph = projectView(state.graph, currentOptions().view);
  state.mermaid = renderMermaid(state.viewGraph, currentOptions());
  state.breakdown = {
    providers: summarizeCounts(state.resources.map((item) => String(item.type || "").toLowerCase().split("/")[0] || "unknown")),
    types: summarizeCounts(state.resources.map((item) => String(item.type || "").toLowerCase())),
  };
  $("#mermaid-output").value = state.mermaid;
  state.selectedId = state.selectedId && state.graph.nodes.some((node) => node.id === state.selectedId)
    ? state.selectedId
    : state.graph.nodes.find((node) => !node.synthetic)?.id || "";

  updateSummaries();
  updateStatus(`Built ${state.viewGraph.nodes.length} nodes and ${state.viewGraph.edges.length} edges for the ${currentOptions().view} view.`);
  renderInventory();
  renderDetail();
  renderCoverage();
  await renderDiagram();
}

function fitDiagram() {
  $("#diagram-shell").scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadSvg() {
  const svg = document.querySelector("#diagram svg");
  if (!svg) {
    updateStatus("Build a topology first so there is an SVG to export.", "warning");
    return;
  }
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  downloadText("azure-topology.svg", new XMLSerializer().serializeToString(clone), "image/svg+xml;charset=utf-8");
}

async function copyMermaid() {
  if (!state.mermaid) {
    updateStatus("Build a topology first so there is Mermaid to copy.", "warning");
    return;
  }
  await navigator.clipboard.writeText(state.mermaid);
  updateStatus("Mermaid source copied to the clipboard.");
}

function exportGraph() {
  if (!state.graph) {
    updateStatus("Build a topology first so there is graph JSON to export.", "warning");
    return;
  }
  downloadText("azure-topology-graph.json", JSON.stringify(state.graph, null, 2), "application/json;charset=utf-8");
}

function clearSession() {
  $("#file-input").value = "";
  $("#json-input").value = "";
  $("#search-input").value = "";
  state.inputs = [];
  state.resources = [];
  state.errors = [];
  state.graph = null;
  state.viewGraph = null;
  state.mermaid = "";
  state.selectedId = "";
  state.breakdown = { providers: [], types: [] };
  $("#diagram").textContent = "Build a topology view to render the diagram.";
  $("#mermaid-output").value = "";
  updateSummaries();
  updateStatus("Session cleared. Load Azure JSON and build the topology to begin.");
  renderInventory();
  renderDetail();
  renderCoverage();
}

function attachEvents() {
  $$('[data-action="render"]').forEach((button) => button.addEventListener("click", rebuild));
  $("#view-select").addEventListener("change", rebuild);
  $("#layout-select").addEventListener("change", rebuild);
  $("#group-select").addEventListener("change", rebuild);
  $("#inferred-toggle").addEventListener("change", rebuild);
  $("#containment-toggle").addEventListener("change", rebuild);
  $$('[data-action="fit"]').forEach((button) => button.addEventListener("click", fitDiagram));
  $("#copy-button").addEventListener("click", copyMermaid);
  $$('[data-action="export-svg"]').forEach((button) => button.addEventListener("click", downloadSvg));
  $("#download-svg-button").addEventListener("click", downloadSvg);
  $("#download-graph-button").addEventListener("click", exportGraph);
  $$('[data-action="clear"]').forEach((button) => button.addEventListener("click", clearSession));
  $("#search-input").addEventListener("input", renderInventory);
  $("#file-input").addEventListener("change", async () => {
    const files = Array.from($("#file-input").files || []);
    $("#file-summary").textContent = files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected.` : "No files selected.";
  });
}

initMermaid();
attachEvents();
updateSummaries();
renderInventory();
renderDetail();
renderCoverage();
