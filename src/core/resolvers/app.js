function linkIfPresent(context, source, target, relation = "depends-on") {
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

export function applyAppResolver(resource, context) {
  if (resource.type === "microsoft.web/sites" || resource.type === "microsoft.web/sites/slots") {
    linkIfPresent(context, resource.id, resource.metadata.properties?.serverFarmId);
    linkIfPresent(context, resource.id, resource.metadata.properties?.hostingEnvironmentId);
    linkIfPresent(context, resource.id, resource.metadata.properties?.managedEnvironmentId);
  }

  if (resource.type === "microsoft.app/containerapps" || resource.type === "microsoft.app/jobs") {
    linkIfPresent(context, resource.id, resource.metadata.properties?.environmentId);
    linkIfPresent(context, resource.id, resource.metadata.properties?.managedEnvironmentId);
    const registries = resource.metadata.properties?.configuration?.registries || [];
    registries.forEach((registry) => {
      linkIfPresent(context, resource.id, registry.identity);
    });
  }
}
