import { describeResourceType, familyLabel } from "./catalog.js";

const ARM_ID_PATTERN = /\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/[^/]+(?:\/[^/]+\/[^/]+)+/i;

export function sanitizeId(value) {
  return String(value || "x").replace(/[^A-Za-z0-9_]/g, "_");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function lastSegment(value) {
  const parts = String(value || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function getPath(obj, path, fallback = undefined) {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return fallback;
    }
    current = current[part];
  }
  return current;
}

export function parseArmId(armId) {
  const result = {
    armId: armId || "",
    subscriptionId: "",
    resourceGroup: "",
    providerNamespace: "",
    types: [],
    names: [],
    resourceType: "",
    fullType: "",
    name: "",
    parentType: "",
    parentName: "",
  };

  if (!armId || !String(armId).includes("/")) {
    return result;
  }

  const parts = String(armId).split("/").filter(Boolean);

  for (let index = 0; index < parts.length; index += 1) {
    const token = parts[index].toLowerCase();
    if (token === "subscriptions" && parts[index + 1]) {
      result.subscriptionId = parts[index + 1];
    }
    if (token === "resourcegroups" && parts[index + 1]) {
      result.resourceGroup = parts[index + 1];
    }
    if (token === "providers" && parts[index + 1]) {
      result.providerNamespace = parts[index + 1];
      for (let cursor = index + 2; cursor < parts.length; cursor += 2) {
        const typePart = parts[cursor];
        const namePart = parts[cursor + 1];
        if (!typePart || !namePart) {
          break;
        }
        result.types.push(typePart);
        result.names.push(namePart);
      }
      break;
    }
  }

  if (result.providerNamespace && result.types.length) {
    result.resourceType = result.types[result.types.length - 1];
    result.fullType = `${result.providerNamespace}/${result.types.join("/")}`.toLowerCase();
    result.name = result.names[result.names.length - 1] || "";
    if (result.types.length > 1) {
      result.parentType = `${result.providerNamespace}/${result.types.slice(0, -1).join("/")}`.toLowerCase();
      result.parentName = result.names[result.names.length - 2] || "";
    }
  }

  return result;
}

export function findArmIds(value, path = "") {
  const found = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findArmIds(item, `${path}[${index}]`));
    });
    return found;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nested]) => {
      const nextPath = path ? `${path}.${key}` : key;
      if (typeof nested === "string" && (key.toLowerCase() === "id" || key.toLowerCase().endsWith("id"))) {
        const match = nested.match(ARM_ID_PATTERN);
        if (match) {
          found.push({ path: nextPath, armId: match[0] });
        }
      } else {
        found.push(...findArmIds(nested, nextPath));
      }
    });
  }

  return found;
}

export function findAllArmIds(value, path = "") {
  const found = [];

  if (typeof value === "string") {
    const match = value.match(ARM_ID_PATTERN);
    if (match) {
      found.push({ path, armId: match[0] });
    }
    return found;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findAllArmIds(item, `${path}[${index}]`));
    });
    return found;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nested]) => {
      const nextPath = path ? `${path}.${key}` : key;
      found.push(...findAllArmIds(nested, nextPath));
    });
  }

  return found;
}

export function resourceKind(type) {
  return describeResourceType(type).kind;
}

export function kindLabel(kind) {
  const labels = {
    subscription: "Subscription",
    resourceGroup: "Resource Group",
    vm: "Virtual Machine",
    vmss: "VM Scale Set",
    nic: "Network Interface",
    disk: "Disk",
    vnet: "Virtual Network",
    subnet: "Subnet",
    nsg: "Network Security Group",
    publicIp: "Public IP",
    privateEndpoint: "Private Endpoint",
    loadBalancer: "Load Balancer",
    applicationGateway: "Application Gateway",
    natGateway: "NAT Gateway",
    firewall: "Azure Firewall",
    routeTable: "Route Table",
    gateway: "Gateway",
    dns: "DNS",
    storage: "Storage Account",
    keyVault: "Key Vault",
    appService: "App Service",
    appPlan: "App Service Plan",
    aks: "AKS",
    sql: "SQL",
    database: "Database",
    messaging: "Messaging",
    containerApp: "Container App",
    containerEnv: "Managed Environment",
    monitoring: "Monitoring",
    recovery: "Recovery",
    network: "Network Resource",
    compute: "Compute Resource",
    app: "App Resource",
    containers: "Container Resource",
    data: "Data Resource",
    integration: "Integration Resource",
    analytics: "Analytics Resource",
    ai: "AI Resource",
    identity: "Identity Resource",
    security: "Security Resource",
    operations: "Operations Resource",
    resource: "Azure Resource",
    aggregate: "Summary",
  };
  return labels[kind] || familyLabel(kind) || "Azure Resource";
}
