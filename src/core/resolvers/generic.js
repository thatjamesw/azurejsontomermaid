import { findAllArmIds } from "../arm.js";

export function applyGenericReferenceResolver(resource, context) {
  const references = findAllArmIds(resource.metadata.properties || {}, "properties");
  references.forEach(({ path, armId }) => {
    if (armId === resource.armId) {
      return;
    }
    if (path.includes("networkProfile.networkInterfaces") || path.includes("storageProfile.osDisk.managedDisk.id")) {
      return;
    }

    const target = context.resourceByArmId.get(armId);
    if (target) {
      context.addEdge({
        source: resource.id,
        target: target.id,
        relation: "depends-on",
        inferred: true,
      });
    }
  });
}
