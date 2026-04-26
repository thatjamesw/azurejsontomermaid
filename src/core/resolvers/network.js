import { getPath, lastSegment, parseArmId } from "../arm.js";

export function applyNetworkResolver(resource, context) {
  if (resource.type === "microsoft.network/virtualnetworks") {
    const subnets = getPath(resource.metadata, "properties.subnets", []) || [];
    subnets.forEach((subnet) => {
      const subnetName = subnet.name || lastSegment(subnet.id || "");
      if (!subnetName) {
        return;
      }
      const subnetArmId = subnet.id || `${resource.armId}/subnets/${subnetName}`;
      context.addSyntheticNode({
        id: subnetArmId,
        armId: subnetArmId,
        type: "microsoft.network/subnets",
        kind: "subnet",
        serviceFamily: "network",
        serviceLabel: "Subnet",
        providerNamespace: "microsoft.network",
        name: subnetName,
        label: subnetName,
        summaryLabel: `Subnet: ${subnetName}`,
        subscriptionId: resource.subscriptionId,
        resourceGroup: resource.resourceGroup,
        metadata: subnet,
        synthetic: true,
      });
      context.addEdge({
        source: resource.id,
        target: subnetArmId,
        relation: "contains",
        inferred: false,
      });
    });
  }

  if (resource.type === "microsoft.network/networkinterfaces") {
    const ipConfigurations = getPath(resource.metadata, "properties.ipConfigurations", []) || [];
    ipConfigurations.forEach((configuration) => {
      const subnetId = getPath(configuration, "properties.subnet.id", "");
      const publicIpId = getPath(configuration, "properties.publicIPAddress.id", "");

      if (subnetId) {
        const subnetArm = parseArmId(subnetId);
        const subnetTarget = subnetArm.name && subnetArm.parentName ? subnetArm.armId : subnetId;
        context.addEdge({
          source: resource.id,
          target: subnetTarget,
          relation: "connects-to",
          inferred: false,
        });
      }

      if (publicIpId) {
        context.addEdge({
          source: resource.id,
          target: publicIpId,
          relation: "connects-to",
          inferred: false,
        });
      }
    });
  }
}
