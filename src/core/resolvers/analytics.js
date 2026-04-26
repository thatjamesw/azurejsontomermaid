import { parseArmId } from "../arm.js";

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

function parentArmId(armId) {
  const parsed = parseArmId(armId);
  if (!parsed.providerNamespace || parsed.types.length < 2 || parsed.names.length < 2) {
    return "";
  }
  const parts = [
    "",
    "subscriptions",
    parsed.subscriptionId,
    "resourceGroups",
    parsed.resourceGroup,
    "providers",
    parsed.providerNamespace,
  ];
  for (let index = 0; index < parsed.types.length - 1; index += 1) {
    parts.push(parsed.types[index], parsed.names[index]);
  }
  return parts.join("/");
}

function findStorageByHost(context, accountUrl) {
  if (!accountUrl) {
    return "";
  }
  const match = String(accountUrl).match(/^https:\/\/([^.]+)\./i);
  if (!match) {
    return "";
  }
  const accountName = match[1].toLowerCase();
  const resource = Array.from(context.resourceByArmId.values()).find((item) => (
    item.type === "microsoft.storage/storageaccounts" &&
    String(item.name || "").toLowerCase() === accountName
  ));
  return resource?.id || "";
}

export function applyAnalyticsResolver(resource, context) {
  if (resource.type === "microsoft.purview/accounts") {
    const managed = resource.metadata.properties?.managedResources || {};
    addTarget(context, resource.id, managed.eventHubNamespace);
    addTarget(context, resource.id, managed.storageAccount);
    const peConnections = resource.metadata.properties?.privateEndpointConnections || [];
    peConnections.forEach((connection) => addTarget(context, resource.id, connection.properties?.privateEndpoint?.id, "connects-to"));
  }

  if (resource.type === "microsoft.databricks/workspaces") {
    const parameters = resource.metadata.properties?.parameters || {};
    addTarget(context, resource.id, resource.metadata.properties?.managedResourceGroupId);
    addTarget(context, resource.id, parameters.customVirtualNetworkId?.value, "connects-to");
    const peConnections = resource.metadata.properties?.privateEndpointConnections || [];
    peConnections.forEach((connection) => addTarget(context, resource.id, connection.properties?.privateEndpoint?.id, "connects-to"));
  }

  if (resource.type === "microsoft.synapse/workspaces") {
    addTarget(context, resource.id, findStorageByHost(context, resource.metadata.properties?.defaultDataLakeStorage?.accountUrl));
    const peConnections = resource.metadata.properties?.privateEndpointConnections || [];
    peConnections.forEach((connection) => addTarget(context, resource.id, connection.properties?.privateEndpoint?.id, "connects-to"));
  }

  if (resource.type === "microsoft.synapse/workspaces/sqlpools" || resource.type === "microsoft.synapse/workspaces/bigdatapools") {
    addTarget(context, resource.id, parentArmId(resource.id));
  }
}
