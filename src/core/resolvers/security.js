function addTarget(context, source, target, relation = "depends-on") {
  if (!target) {
    return;
  }
  context.addEdge({
    source,
    target,
    relation,
    inferred: false,
  });
}

export function applySecurityResolver(resource, context) {
  if (resource.type === "microsoft.keyvault/vaults") {
    const rules = resource.metadata.properties?.networkAcls?.virtualNetworkRules || [];
    rules.forEach((rule) => addTarget(context, resource.id, rule.id, "connects-to"));
  }

  if (resource.type === "microsoft.appconfiguration/configurationstores") {
    const keyIdentifier = resource.metadata.properties?.encryption?.keyVaultProperties?.keyIdentifier;
    if (keyIdentifier) {
      addTarget(context, resource.id, keyIdentifier, "depends-on");
    }
    const privateEndpoints = resource.metadata.properties?.privateEndpointConnections || [];
    privateEndpoints.forEach((connection) => addTarget(context, resource.id, connection.properties?.privateEndpoint?.id, "connects-to"));
  }

  if (resource.type === "microsoft.search/searchservices") {
    const privateEndpoints = resource.metadata.properties?.privateEndpointConnections || [];
    privateEndpoints.forEach((connection) => addTarget(context, resource.id, connection.properties?.privateEndpoint?.id, "connects-to"));
  }
}
