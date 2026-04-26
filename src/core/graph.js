import { kindLabel, parseArmId, sanitizeId } from "./arm.js";
import { describeResourceType } from "./catalog.js";
import { applyAiResolver } from "./resolvers/ai.js";
import { applyAnalyticsResolver } from "./resolvers/analytics.js";
import { applyAppResolver } from "./resolvers/app.js";
import { applyComputeResolver } from "./resolvers/compute.js";
import { applyContainersResolver } from "./resolvers/containers.js";
import { applyDataResolver } from "./resolvers/data.js";
import { applyGenericReferenceResolver } from "./resolvers/generic.js";
import { applyIntegrationResolver } from "./resolvers/integration.js";
import { applyNetworkResolver } from "./resolvers/network.js";
import { applyOperationsResolver } from "./resolvers/operations.js";
import { applySecurityResolver } from "./resolvers/security.js";

function makeNodeId(prefix, value) {
  return `${prefix}:${sanitizeId(value)}`;
}

function addNode(map, node) {
  if (!map.has(node.id)) {
    map.set(node.id, node);
  }
  return map.get(node.id);
}

function addEdge(map, edge) {
  const id = `${edge.source}|${edge.target}|${edge.relation}`;
  if (!map.has(id)) {
    map.set(id, { ...edge, id });
  }
}

function summarizeLabel(resource) {
  const kindText = resource.serviceLabel || kindLabel(resource.kind);
  return `${kindText}: ${resource.name}`;
}

function createResourceNode(resource) {
  const arm = parseArmId(resource.id || "");
  const descriptor = describeResourceType(resource.type);
  return {
    id: resource.id || `resource:${sanitizeId(resource.type)}:${sanitizeId(resource.name)}`,
    armId: resource.id || "",
    type: resource.type,
    kind: descriptor.kind,
    serviceFamily: descriptor.serviceFamily,
    serviceLabel: descriptor.label,
    providerNamespace: arm.providerNamespace.toLowerCase(),
    name: resource.name,
    label: resource.name,
    summaryLabel: summarizeLabel({ ...resource, kind: descriptor.kind, serviceLabel: descriptor.label }),
    subscriptionId: resource.subscriptionId || arm.subscriptionId || "unknown-subscription",
    resourceGroup: resource.resourceGroup || arm.resourceGroup || "unknown-resource-group",
    sourceName: resource.__source || "",
    metadata: resource,
    synthetic: false,
  };
}

function createSyntheticNode(id, kind, name, label, extra = {}) {
  return {
    id,
    armId: "",
    type: kind,
    kind,
    serviceFamily: extra.serviceFamily || "resource",
    serviceLabel: extra.serviceLabel || kindLabel(kind),
    providerNamespace: extra.providerNamespace || "",
    name,
    label,
    summaryLabel: label,
    metadata: {},
    synthetic: true,
    ...extra,
  };
}

function createExternalReferenceNode(armId) {
  const parsed = parseArmId(armId);
  const descriptor = describeResourceType(parsed.fullType || "");
  const name = parsed.name || armId;
  const label = `${descriptor.label || kindLabel(descriptor.kind)}: ${name}`;
  return createSyntheticNode(
    armId,
    descriptor.kind || "resource",
    name,
    label,
    {
      armId,
      type: parsed.fullType || descriptor.kind || "resource",
      serviceFamily: descriptor.serviceFamily || "resource",
      serviceLabel: descriptor.label || kindLabel(descriptor.kind),
      providerNamespace: (parsed.providerNamespace || "").toLowerCase(),
      subscriptionId: parsed.subscriptionId || "unknown-subscription",
      resourceGroup: parsed.resourceGroup || "external",
      metadata: { externalReference: true },
      synthetic: true,
    }
  );
}

function isNetworkKind(node) {
  return node.serviceFamily === "network" || [
    "vm",
    "vmss",
    "nic",
    "subnet",
    "publicIp",
    "privateEndpoint",
  ].includes(node.kind);
}

function isPlatformKind(node) {
  return !["nic", "disk", "publicIp", "subnet"].includes(node.kind);
}

export function buildGraph(resources, options = {}) {
  const nodes = new Map();
  const edges = new Map();
  const resourceNodeIds = new Set();
  const normalized = resources.map(createResourceNode);
  const resourceByArmId = new Map(normalized.map((resource) => [resource.armId, resource]));

  const context = {
    resourceByArmId,
    addEdge: (edge) => {
      if (typeof edge.target === "string" && edge.target.startsWith("/subscriptions/") && !nodes.has(edge.target)) {
        addNode(nodes, createExternalReferenceNode(edge.target));
      }
      addEdge(edges, edge);
    },
    addSyntheticNode: (node) => addNode(nodes, node),
  };

  normalized.forEach((resource) => {
    resourceNodeIds.add(resource.id);
    addNode(nodes, resource);

    const subscriptionNodeId = makeNodeId("subscription", resource.subscriptionId);
    addNode(nodes, createSyntheticNode(subscriptionNodeId, "subscription", resource.subscriptionId, resource.subscriptionId, {
      subscriptionId: resource.subscriptionId,
      serviceFamily: "resource",
      serviceLabel: "Subscription",
    }));

    if (options.grouping !== "none") {
      const groupSeed = options.grouping === "subscription"
        ? `${resource.subscriptionId}:subscription-scope`
        : `${resource.subscriptionId}:${resource.resourceGroup}`;
      const groupNodeId = makeNodeId("group", groupSeed);
      const groupLabel = options.grouping === "subscription" ? "Subscription scope" : resource.resourceGroup;

      addNode(nodes, createSyntheticNode(groupNodeId, "resourceGroup", groupLabel, groupLabel, {
        subscriptionId: resource.subscriptionId,
        resourceGroup: resource.resourceGroup,
        serviceFamily: "resource",
        serviceLabel: "Resource Group",
      }));

      if (options.includeContainment !== false) {
        addEdge(edges, {
          source: subscriptionNodeId,
          target: groupNodeId,
          relation: "contains",
          inferred: false,
        });
        addEdge(edges, {
          source: groupNodeId,
          target: resource.id,
          relation: "contains",
          inferred: false,
        });
      }
    }
  });

  normalized.forEach((resource) => {
    applyAiResolver(resource, context);
    applyAnalyticsResolver(resource, context);
    applyAppResolver(resource, context);
    applyContainersResolver(resource, context);
    applyDataResolver(resource, context);
    applyIntegrationResolver(resource, context);
    applyNetworkResolver(resource, context);
    applyComputeResolver(resource, context);
    applyOperationsResolver(resource, context);
    applySecurityResolver(resource, context);
    if (options.includeInferred !== false) {
      applyGenericReferenceResolver(resource, context);
    }
  });

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()).filter((edge) => nodes.has(edge.source) && nodes.has(edge.target)),
    stats: {
      resources: normalized.length,
      subscriptions: new Set(normalized.map((item) => item.subscriptionId)).size,
      resourceGroups: new Set(normalized.map((item) => `${item.subscriptionId}:${item.resourceGroup}`)).size,
      files: new Set(normalized.map((item) => item.sourceName).filter(Boolean)).size,
      providers: new Set(normalized.map((item) => item.providerNamespace).filter(Boolean)).size,
      resourceTypes: new Set(normalized.map((item) => item.type).filter(Boolean)).size,
    },
    helpers: {
      resourceNodeIds,
    },
  };
}

export function projectView(graph, view) {
  const includeNode = (node) => {
    if (node.kind === "subscription" || node.kind === "resourceGroup") {
      return true;
    }
    if (view === "full") {
      return true;
    }
    if (view === "network") {
      return isNetworkKind(node);
    }
    if (view === "platform") {
      return isPlatformKind(node);
    }
    return false;
  };

  if (view === "high") {
    return projectHighLevel(graph);
  }

  const nodes = graph.nodes.filter(includeNode);
  const allowed = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => allowed.has(edge.source) && allowed.has(edge.target));

  return { nodes, edges };
}

function projectHighLevel(graph) {
  const nodes = new Map();
  const edges = new Map();

  graph.nodes
    .filter((node) => node.kind === "subscription" || node.kind === "resourceGroup")
    .forEach((node) => nodes.set(node.id, { ...node }));

  graph.nodes
    .filter((node) => !node.synthetic && node.kind !== "subscription" && node.kind !== "resourceGroup")
    .forEach((node) => {
      const aggregateGroup = `${node.subscriptionId}:${node.resourceGroup}:${node.kind}`;
      const aggregateId = `aggregate:${sanitizeId(aggregateGroup)}`;
      const existing = nodes.get(aggregateId);
      if (!existing) {
        nodes.set(aggregateId, createSyntheticNode(
          aggregateId,
          "aggregate",
          node.kind,
          `${kindLabel(node.kind)} x1`,
          {
            subscriptionId: node.subscriptionId,
            resourceGroup: node.resourceGroup,
            count: 1,
            aggregateKind: node.kind,
            serviceFamily: node.serviceFamily,
            serviceLabel: node.serviceLabel,
          }
        ));
      } else {
        existing.count += 1;
        existing.label = `${kindLabel(existing.aggregateKind)} x${existing.count}`;
        existing.summaryLabel = existing.label;
      }

      const groupNodeId = makeNodeId("group", `${node.subscriptionId}:${node.resourceGroup}`);
      if (nodes.has(groupNodeId)) {
        addEdge(edges, {
          source: groupNodeId,
          target: aggregateId,
          relation: "contains",
          inferred: false,
        });
      }
    });

  graph.edges
    .filter((edge) => {
      const source = graph.nodes.find((node) => node.id === edge.source);
      const target = graph.nodes.find((node) => node.id === edge.target);
      return source && target && !source.synthetic && !target.synthetic;
    })
    .forEach((edge) => {
      const sourceNode = graph.nodes.find((node) => node.id === edge.source);
      const targetNode = graph.nodes.find((node) => node.id === edge.target);
      const sourceAggregate = `aggregate:${sanitizeId(`${sourceNode.subscriptionId}:${sourceNode.resourceGroup}:${sourceNode.kind}`)}`;
      const targetAggregate = `aggregate:${sanitizeId(`${targetNode.subscriptionId}:${targetNode.resourceGroup}:${targetNode.kind}`)}`;
      if (sourceAggregate !== targetAggregate && nodes.has(sourceAggregate) && nodes.has(targetAggregate)) {
        addEdge(edges, {
          source: sourceAggregate,
          target: targetAggregate,
          relation: edge.relation,
          inferred: edge.inferred,
        });
      }
    });

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()).filter((edge) => nodes.has(edge.source) && nodes.has(edge.target)),
  };
}
