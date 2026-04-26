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

function walkApiConnections(value, found = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => walkApiConnections(item, found));
    return found;
  }

  if (!value || typeof value !== "object") {
    return found;
  }

  if (value.type === "ApiConnection" && value.inputs?.host?.connection?.name) {
    const expression = String(value.inputs.host.connection.name);
    const match = expression.match(/\['([^']+)'\]\['connectionId'\]/);
    if (match) {
      found.add(match[1]);
    }
  }

  Object.values(value).forEach((nested) => walkApiConnections(nested, found));
  return found;
}

function makeLogicConnectionNodeId(workflowId, alias) {
  return `logic-connection:${workflowId}:${alias}`;
}

function connectionCandidates(resourceByArmId, subscriptionId, aliases) {
  const resources = Array.from(resourceByArmId.values()).filter((item) => item.type === "microsoft.web/connections");
  return resources.filter((resource) => {
    const apiName = String(resource.metadata.properties?.api?.name || "").toLowerCase();
    const displayName = String(resource.metadata.properties?.displayName || "").toLowerCase();
    const name = String(resource.name || "").toLowerCase();
    return aliases.some((alias) => alias === apiName || alias === name || displayName.includes(alias));
  });
}

export function applyIntegrationResolver(resource, context) {
  if (resource.type === "microsoft.web/connections") {
    addTarget(context, resource.id, resource.metadata.properties?.api?.id, "depends-on");

    const connectorName = String(resource.metadata.properties?.api?.name || "").toLowerCase();
    const vaultName = resource.metadata.properties?.parameterValueSet?.values?.vaultName?.value;
    if (connectorName === "keyvault" && vaultName) {
      const vault = Array.from(context.resourceByArmId.values()).find((item) => (
        item.type === "microsoft.keyvault/vaults" &&
        String(item.name || "").toLowerCase() === String(vaultName).toLowerCase()
      ));
      if (vault) {
        addTarget(context, resource.id, vault.id, "depends-on");
      }
    }
  }

  if (resource.type === "microsoft.logic/workflows") {
    const aliases = Array.from(walkApiConnections(resource.metadata.properties?.definition || {})).map((item) => item.toLowerCase());
    const matched = connectionCandidates(context.resourceByArmId, resource.subscriptionId, aliases);
    matched.forEach((connection) => addTarget(context, resource.id, connection.id, "depends-on"));

    aliases.forEach((alias) => {
      const hasMatch = matched.some((connection) => {
        const apiName = String(connection.metadata.properties?.api?.name || "").toLowerCase();
        const name = String(connection.name || "").toLowerCase();
        return apiName === alias || name === alias;
      });
      if (!hasMatch) {
        const syntheticId = makeLogicConnectionNodeId(resource.id, alias);
        context.addSyntheticNode({
          id: syntheticId,
          armId: "",
          type: "microsoft.web/connections",
          kind: "integration",
          serviceFamily: "integration",
          serviceLabel: `Logic Connection (${alias})`,
          providerNamespace: "microsoft.web",
          name: alias,
          label: alias,
          summaryLabel: `Logic Connection (${alias})`,
          subscriptionId: resource.subscriptionId,
          resourceGroup: resource.resourceGroup,
          metadata: { alias, inferred: true },
          synthetic: true,
        });
        addTarget(context, resource.id, syntheticId, "depends-on");
      }
    });
  }

  if (resource.type === "microsoft.servicebus/namespaces" || resource.type === "microsoft.eventhub/namespaces" || resource.type === "microsoft.eventgrid/topics") {
    const privateEndpoints = resource.metadata.properties?.privateEndpointConnections || [];
    privateEndpoints.forEach((connection) => addTarget(context, resource.id, connection.properties?.privateEndpoint?.id, "connects-to"));
  }

  if (resource.type === "microsoft.apimanagement/service") {
    addTarget(context, resource.id, resource.metadata.properties?.publicIpAddressId);
    addTarget(context, resource.id, resource.metadata.properties?.virtualNetworkConfiguration?.subnetResourceId, "connects-to");
    const hostnames = resource.metadata.properties?.hostnameConfigurations || [];
    hostnames.forEach((hostname) => addTarget(context, resource.id, hostname.keyVaultId));
    const privateEndpoints = resource.metadata.properties?.privateEndpointConnections || [];
    privateEndpoints.forEach((connection) => addTarget(context, resource.id, connection.properties?.privateEndpoint?.id, "connects-to"));
  }
}
