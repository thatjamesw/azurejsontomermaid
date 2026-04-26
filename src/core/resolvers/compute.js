import { getPath } from "../arm.js";

export function applyComputeResolver(resource, context) {
  if (resource.type !== "microsoft.compute/virtualmachines") {
    return;
  }

  const nics = getPath(resource.metadata, "properties.networkProfile.networkInterfaces", []) || [];
  nics.forEach((nic) => {
    if (nic.id) {
      context.addEdge({
        source: resource.id,
        target: nic.id,
        relation: "attached-to",
        inferred: false,
      });
    }
  });

  const osDiskId = getPath(resource.metadata, "properties.storageProfile.osDisk.managedDisk.id", "");
  if (osDiskId) {
    context.addEdge({
      source: resource.id,
      target: osDiskId,
      relation: "attached-to",
      inferred: false,
    });
  }
}
