export function applyContainersResolver(resource, context) {
  if (resource.type !== "microsoft.containerservice/managedclusters") {
    return;
  }

  const addonProfiles = resource.metadata.properties?.addonProfiles || {};
  Object.values(addonProfiles).forEach((profile) => {
    const identityResourceId = profile?.identity?.resourceId;
    if (identityResourceId) {
      context.addEdge({
        source: resource.id,
        target: identityResourceId,
        relation: "depends-on",
        inferred: false,
      });
    }
  });

  const workspaceId = addonProfiles.omsagent?.config?.logAnalyticsWorkspaceResourceID;
  if (workspaceId) {
    context.addEdge({
      source: resource.id,
      target: workspaceId,
      relation: "protects",
      inferred: false,
    });
  }

  const securityProfile = resource.metadata.properties?.securityProfile || {};
  if (securityProfile.keyVaultResourceId) {
    context.addEdge({
      source: resource.id,
      target: securityProfile.keyVaultResourceId,
      relation: "depends-on",
      inferred: false,
    });
  }

  const agentPools = resource.metadata.properties?.agentPoolProfiles || [];
  agentPools.forEach((pool) => {
    [pool.podSubnetID, pool.vnetSubnetID].forEach((subnetId) => {
      if (subnetId) {
        context.addEdge({
          source: resource.id,
          target: subnetId,
          relation: "connects-to",
          inferred: false,
        });
      }
    });
  });
}
