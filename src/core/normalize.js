import { lastSegment, parseArmId } from "./arm.js";

function pushResource(output, item, sourceName) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return;
  }

  const arm = parseArmId(item.id || "");
  const resource = {
    ...item,
    type: String(item.type || arm.fullType || "").toLowerCase(),
    name: item.name || arm.name || lastSegment(item.id || ""),
    subscriptionId: item.subscriptionId || arm.subscriptionId || "unknown-subscription",
    resourceGroup: item.resourceGroup || arm.resourceGroup || "unknown-resource-group",
    __source: sourceName,
  };

  if (resource.type && resource.name) {
    output.push(resource);
  }
}

function walkPayload(payload, output, sourceName) {
  if (Array.isArray(payload)) {
    payload.forEach((item) => walkPayload(item, output, sourceName));
    return;
  }

  if (!payload || typeof payload !== "object") {
    return;
  }

  if (payload.type || payload.id || payload.name) {
    pushResource(output, payload, sourceName);
  }

  if (Array.isArray(payload.value)) {
    payload.value.forEach((item) => walkPayload(item, output, sourceName));
  }

  if (Array.isArray(payload.resources)) {
    payload.resources.forEach((item) => walkPayload(item, output, sourceName));
  }
}

export function normalizePayloads(inputs) {
  const resources = [];
  const errors = [];

  inputs.forEach(({ name, text }) => {
    if (!text || !text.trim()) {
      return;
    }
    try {
      const payload = JSON.parse(text);
      walkPayload(payload, resources, name);
    } catch (error) {
      errors.push({ name, error: error.message });
    }
  });

  return { resources, errors };
}
