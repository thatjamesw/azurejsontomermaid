function subscriptionScopeToNodeId(scope) {
  const match = String(scope || "").match(/^\/subscriptions\/([^/]+)$/i);
  return match ? `subscription:${match[1].replace(/[^A-Za-z0-9_]/g, "_")}` : "";
}

function addTargets(context, source, targets, relation) {
  targets.filter(Boolean).forEach((target) => {
    context.addEdge({
      source,
      target: subscriptionScopeToNodeId(target) || target,
      relation,
      inferred: false,
    });
  });
}

export function applyOperationsResolver(resource, context) {
  if (resource.type === "microsoft.insights/metricalerts") {
    addTargets(context, resource.id, resource.metadata.properties?.scopes || [], "protects");
    addTargets(context, resource.id, (resource.metadata.properties?.actions || []).map((item) => item.actionGroupId), "depends-on");
  }

  if (resource.type === "microsoft.insights/activitylogalerts") {
    addTargets(context, resource.id, resource.metadata.properties?.scopes || [], "protects");
    addTargets(context, resource.id, (resource.metadata.properties?.actions?.actionGroups || []).map((item) => item.actionGroupId), "depends-on");
  }

  if (resource.type === "microsoft.alertsmanagement/smartdetectoralertrules") {
    addTargets(context, resource.id, resource.metadata.properties?.scope || [], "protects");
    addTargets(context, resource.id, resource.metadata.properties?.actionGroups?.groupIds || [], "depends-on");
  }

  if (resource.type === "microsoft.monitor/accounts") {
    addTargets(context, resource.id, [
      resource.metadata.properties?.defaultIngestionSettings?.dataCollectionEndpointResourceId,
      resource.metadata.properties?.defaultIngestionSettings?.dataCollectionRuleResourceId,
    ], "depends-on");
  }

  if (resource.type === "microsoft.insights/datacollectionrules") {
    const laws = resource.metadata.properties?.destinations?.logAnalytics || [];
    addTargets(context, resource.id, laws.map((item) => item.workspaceResourceId), "depends-on");
  }

  if (resource.type === "microsoft.insights/privatelinkscopes") {
    const peConnections = resource.metadata.properties?.privateEndpointConnections || [];
    addTargets(context, resource.id, peConnections.map((item) => item.properties?.privateEndpoint?.id), "connects-to");
  }

  if (resource.type === "microsoft.insights/workbooks") {
    addTargets(context, resource.id, [resource.metadata.properties?.sourceId], "depends-on");
  }

  if (resource.type === "microsoft.insights/webtests") {
    const hiddenLinks = Object.keys(resource.metadata.tags || {})
      .filter((key) => key.toLowerCase().startsWith("hidden-link:"))
      .map((key) => key.slice("hidden-link:".length));
    addTargets(context, resource.id, hiddenLinks, "protects");
  }
}
