import { parseArmId } from "../arm.js";

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

export function applyDataResolver(resource, context) {
  if (resource.type === "microsoft.sql/servers/databases" && resource.metadata.managedBy) {
    context.addEdge({
      source: resource.id,
      target: resource.metadata.managedBy,
      relation: "depends-on",
      inferred: false,
    });
  }

  if (resource.type === "microsoft.sql/managedinstances/databases") {
    const parentId = parentArmId(resource.id);
    if (parentId) {
      context.addEdge({
        source: resource.id,
        target: parentId,
        relation: "depends-on",
        inferred: false,
      });
    }
  }
}
