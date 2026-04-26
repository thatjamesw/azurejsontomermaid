function setServiceLabel(resource, label) {
  resource.serviceLabel = label;
  resource.summaryLabel = `${label}: ${resource.name}`;
}

export function applyAiResolver(resource, context) {
  if (resource.type === "microsoft.cognitiveservices/accounts") {
    const kind = String(resource.metadata.kind || "").toLowerCase();
    if (kind.includes("openai") || kind.includes("aiservices")) {
      setServiceLabel(resource, "Azure AI Foundry");
    } else if (resource.metadata.kind) {
      setServiceLabel(resource, `Azure AI ${resource.metadata.kind}`);
    }
  }

  if (resource.type === "microsoft.machinelearningservices/workspaces") {
    [
      resource.metadata.properties?.applicationInsights,
      resource.metadata.properties?.keyVault,
      resource.metadata.properties?.storageAccount,
    ].forEach((target) => {
      if (target) {
        context.addEdge({
          source: resource.id,
          target,
          relation: "depends-on",
          inferred: false,
        });
      }
    });
  }
}
