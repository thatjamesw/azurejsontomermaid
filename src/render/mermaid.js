import { escapeHtml, sanitizeId } from "../core/arm.js";

const DEFAULT_CHUNK_LIMITS = {
  maxChars: 120000,
  maxNodes: 180,
  maxEdges: 220,
};

function classForKind(kind) {
  const map = {
    subscription: "subscription",
    resourceGroup: "resourceGroup",
    aggregate: "aggregate",
    vm: "compute",
    vmss: "compute",
    disk: "compute",
    nic: "network",
    vnet: "network",
    subnet: "network",
    nsg: "network",
    publicIp: "network",
    privateEndpoint: "network",
    loadBalancer: "network",
    applicationGateway: "network",
    natGateway: "network",
    firewall: "network",
    routeTable: "network",
    gateway: "network",
    dns: "network",
    aks: "platform",
    appService: "platform",
    appPlan: "platform",
    keyVault: "platform",
    storage: "platform",
    sql: "platform",
    database: "platform",
    messaging: "platform",
    containerApp: "platform",
    containerEnv: "platform",
    monitoring: "platform",
    recovery: "platform",
    containers: "platform",
    data: "platform",
    integration: "platform",
    analytics: "platform",
    ai: "platform",
    identity: "platform",
    security: "platform",
    operations: "platform",
    app: "platform",
    network: "network",
    compute: "compute",
    resource: "resource",
  };
  return map[kind] || "resource";
}

function relationArrow(relation) {
  if (relation === "contains") {
    return "-->";
  }
  if (relation === "protects") {
    return "-.->";
  }
  return "==>";
}

function nodeRef(nodeId) {
  return `n_${sanitizeId(nodeId)}`;
}

function addClassDefs(lines) {
  lines.push("classDef subscription fill:#dff0ff,stroke:#0078d4,color:#083b66,stroke-width:1.5px;");
  lines.push("classDef resourceGroup fill:#eef6fb,stroke:#8ab8e0,color:#0f2940;");
  lines.push("classDef aggregate fill:#f2f7fd,stroke:#90b9dc,color:#17415f,stroke-dasharray: 4 2;");
  lines.push("classDef network fill:#edf6ff,stroke:#4a90d9,color:#0d3a61;");
  lines.push("classDef compute fill:#f6f2ff,stroke:#7e6ad6,color:#33255c;");
  lines.push("classDef platform fill:#eefbf5,stroke:#43a672,color:#144e30;");
  lines.push("classDef resource fill:#ffffff,stroke:#a6b0bd,color:#0f172a;");
}

function layoutConfig(options = {}) {
  const outer = options.layout === "TB" ? "TB" : "LR";
  return {
    outer,
    subscription: outer,
    group: outer === "LR" ? "TB" : "LR",
    lane: outer === "LR" ? "LR" : "TB",
  };
}

function familyLane(serviceFamily) {
  const lane = ["network", "compute", "platform", "resource"].includes(serviceFamily)
    ? serviceFamily
    : "resource";
  const labelMap = {
    network: "Network",
    compute: "Compute",
    platform: "Platform",
    resource: "Supporting resources",
  };
  return {
    key: lane,
    label: labelMap[lane],
  };
}

function groupNodesByLane(nodes) {
  const lanes = new Map();
  nodes.forEach((node) => {
    const lane = familyLane(node.serviceFamily);
    if (!lanes.has(lane.key)) {
      lanes.set(lane.key, {
        ...lane,
        nodes: [],
      });
    }
    lanes.get(lane.key).nodes.push(node);
  });
  return ["network", "compute", "platform", "resource"]
    .map((key) => lanes.get(key))
    .filter(Boolean);
}

export function renderMermaid(viewGraph, options = {}) {
  const layout = layoutConfig(options);
  const grouping = options.grouping || "resourceGroup";
  const lines = [`flowchart ${layout.outer}`];
  addClassDefs(lines);

  const subscriptions = viewGraph.nodes.filter((node) => node.kind === "subscription");
  const groups = viewGraph.nodes.filter((node) => node.kind === "resourceGroup");
  const others = viewGraph.nodes.filter((node) => node.kind !== "subscription" && node.kind !== "resourceGroup");
  const emitted = new Set();

  const emitNode = (node, indent = "") => {
    const ref = nodeRef(node.id);
    if (emitted.has(ref)) {
      return;
    }
    const label = escapeHtml(node.summaryLabel || node.label || node.name || node.id);
    lines.push(`${indent}${ref}["${label}"]:::${classForKind(node.kind)}`);
    emitted.add(ref);
  };

  if (grouping === "none") {
    [...subscriptions, ...groups, ...others].forEach((node) => emitNode(node));
  } else {
    subscriptions.forEach((subscription) => {
      lines.push(`subgraph ${nodeRef(subscription.id)}_sg["${escapeHtml(subscription.label || subscription.name)}"]`);
      lines.push(`direction ${layout.subscription}`);

      const subscriptionGroups = groups.filter((group) => group.subscriptionId === subscription.subscriptionId);
      if (grouping === "subscription") {
        const subscriptionNodes = others
          .filter((node) => node.subscriptionId === subscription.subscriptionId)
          .sort((left, right) => left.name.localeCompare(right.name));
        const lanes = groupNodesByLane(subscriptionNodes);
        const renderLanes = lanes.length > 1;

        if (renderLanes) {
          lanes.forEach((lane) => {
            lines.push(`  subgraph ${nodeRef(subscription.id)}_${lane.key}_lane["${escapeHtml(lane.label)}"]`);
            lines.push(`  direction ${layout.lane}`);
            lane.nodes.forEach((node) => emitNode(node, "    "));
            lines.push("  end");
          });
        } else {
          subscriptionNodes.forEach((node) => emitNode(node, "  "));
        }
      } else {
        subscriptionGroups.forEach((group) => {
          lines.push(`  subgraph ${nodeRef(group.id)}_sg["${escapeHtml(group.label || group.name)}"]`);
          lines.push(`  direction ${layout.group}`);
          const groupNodes = others
            .filter((node) => node.subscriptionId === group.subscriptionId && node.resourceGroup === group.resourceGroup)
            .sort((left, right) => left.name.localeCompare(right.name));
          const lanes = groupNodesByLane(groupNodes);
          const renderLanes = lanes.length > 1;

          if (renderLanes) {
            lanes.forEach((lane) => {
              lines.push(`    subgraph ${nodeRef(group.id)}_${lane.key}_lane["${escapeHtml(lane.label)}"]`);
              lines.push(`    direction ${layout.lane}`);
              lane.nodes.forEach((node) => emitNode(node, "      "));
              lines.push("    end");
            });
          } else {
            groupNodes.forEach((node) => emitNode(node, "    "));
          }
          lines.push("  end");
        });
      }

      lines.push("end");
    });
  }

  if (grouping !== "resourceGroup" && grouping !== "subscription") {
    others.forEach((node) => emitNode(node));
  }

  viewGraph.edges.forEach((edge) => {
    const source = nodeRef(edge.source);
    const target = nodeRef(edge.target);
    if (!emitted.has(source)) {
      const sourceNode = viewGraph.nodes.find((node) => node.id === edge.source);
      if (sourceNode) {
        emitNode(sourceNode);
      }
    }
    if (!emitted.has(target)) {
      const targetNode = viewGraph.nodes.find((node) => node.id === edge.target);
      if (targetNode) {
        emitNode(targetNode);
      }
    }
    const arrow = relationArrow(edge.relation);
    lines.push(`${source} ${arrow} ${target}`);
  });

  return lines.join("\n");
}

function makeChunkTitle(nodes) {
  const first = nodes[0];
  if (!first) {
    return "Topology chunk";
  }
  const subscription = first.subscriptionId || "unknown-subscription";
  const resourceGroup = first.resourceGroup || "unknown-resource-group";
  return `${subscription} / ${resourceGroup}`;
}

function fitsChunk(document, limits) {
  return document.mermaid.length <= limits.maxChars
    && document.nodeCount <= limits.maxNodes
    && document.edgeCount <= limits.maxEdges;
}

function buildChunkDocument(viewGraph, options, nodeIds, title) {
  const nodes = viewGraph.nodes.filter((node) => nodeIds.has(node.id));
  const edges = viewGraph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  return {
    title,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    mermaid: renderMermaid({ nodes, edges }, options),
  };
}

function chunkNodes(viewGraph, options, nodes, limits, title, depth = 0) {
  const scopedNodeIds = new Set(nodes.map((node) => node.id));

  nodes.forEach((node) => {
    viewGraph.nodes.forEach((candidate) => {
      if (
        (candidate.kind === "subscription" && candidate.subscriptionId === node.subscriptionId)
        || (
          candidate.kind === "resourceGroup"
          && candidate.subscriptionId === node.subscriptionId
          && candidate.resourceGroup === node.resourceGroup
        )
      ) {
        scopedNodeIds.add(candidate.id);
      }
    });
  });

  const document = buildChunkDocument(viewGraph, options, scopedNodeIds, title);
  if (fitsChunk(document, limits) || nodes.length <= 1 || depth >= 8) {
    return [document];
  }

  const sorted = [...nodes].sort((left, right) => left.name.localeCompare(right.name));
  const midpoint = Math.ceil(sorted.length / 2);
  const leftTitle = `${title} (part 1)`;
  const rightTitle = `${title} (part 2)`;

  return [
    ...chunkNodes(viewGraph, options, sorted.slice(0, midpoint), limits, leftTitle, depth + 1),
    ...chunkNodes(viewGraph, options, sorted.slice(midpoint), limits, rightTitle, depth + 1),
  ];
}

export function createMermaidDocuments(viewGraph, options = {}, limits = {}) {
  const resolvedLimits = { ...DEFAULT_CHUNK_LIMITS, ...limits };
  const primary = {
    title: "Complete topology",
    nodeCount: viewGraph.nodes.length,
    edgeCount: viewGraph.edges.length,
    mermaid: renderMermaid(viewGraph, options),
  };

  if (fitsChunk(primary, resolvedLimits)) {
    return {
      mode: "single",
      documents: [primary],
      primary,
    };
  }

  const resourceNodes = viewGraph.nodes.filter((node) => node.kind !== "subscription" && node.kind !== "resourceGroup");
  const groups = new Map();

  resourceNodes.forEach((node) => {
    const key = `${node.subscriptionId || "unknown-subscription"}::${node.resourceGroup || "unknown-resource-group"}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(node);
  });

  const documents = Array.from(groups.values())
    .sort((left, right) => right.length - left.length || makeChunkTitle(left).localeCompare(makeChunkTitle(right)))
    .flatMap((nodes) => chunkNodes(viewGraph, options, nodes, resolvedLimits, makeChunkTitle(nodes)));

  return {
    mode: "chunked",
    documents,
    primary,
  };
}
