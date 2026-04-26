import { escapeHtml, sanitizeId } from "../core/arm.js";

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

export function renderMermaid(viewGraph, options = {}) {
  const direction = options.layout === "TB" ? "TB" : "LR";
  const grouping = options.grouping || "resourceGroup";
  const lines = [`flowchart ${direction}`];
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
      lines.push("direction TB");

      const subscriptionGroups = groups.filter((group) => group.subscriptionId === subscription.subscriptionId);
      if (grouping === "subscription") {
        others
          .filter((node) => node.subscriptionId === subscription.subscriptionId)
          .forEach((node) => emitNode(node, "  "));
      } else {
        subscriptionGroups.forEach((group) => {
          lines.push(`  subgraph ${nodeRef(group.id)}_sg["${escapeHtml(group.label || group.name)}"]`);
          lines.push("  direction LR");
          others
            .filter((node) => node.subscriptionId === group.subscriptionId && node.resourceGroup === group.resourceGroup)
            .forEach((node) => emitNode(node, "    "));
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
