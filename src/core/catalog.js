function titleCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

const EXPLICIT_KIND_MAP = {
  "microsoft.network/virtualnetworks": { kind: "vnet", serviceFamily: "network", label: "Virtual Network" },
  "microsoft.network/subnets": { kind: "subnet", serviceFamily: "network", label: "Subnet" },
  "microsoft.network/networkinterfaces": { kind: "nic", serviceFamily: "network", label: "Network Interface" },
  "microsoft.network/networksecuritygroups": { kind: "nsg", serviceFamily: "network", label: "Network Security Group" },
  "microsoft.network/publicipaddresses": { kind: "publicIp", serviceFamily: "network", label: "Public IP" },
  "microsoft.network/publicipprefixes": { kind: "publicIp", serviceFamily: "network", label: "Public IP Prefix" },
  "microsoft.network/privateendpoints": { kind: "privateEndpoint", serviceFamily: "network", label: "Private Endpoint" },
  "microsoft.network/loadbalancers": { kind: "loadBalancer", serviceFamily: "network", label: "Load Balancer" },
  "microsoft.network/applicationgateways": { kind: "applicationGateway", serviceFamily: "network", label: "Application Gateway" },
  "microsoft.network/natgateways": { kind: "natGateway", serviceFamily: "network", label: "NAT Gateway" },
  "microsoft.network/azurefirewalls": { kind: "firewall", serviceFamily: "network", label: "Azure Firewall" },
  "microsoft.network/routetables": { kind: "routeTable", serviceFamily: "network", label: "Route Table" },
  "microsoft.network/virtualnetworkgateways": { kind: "gateway", serviceFamily: "network", label: "Virtual Network Gateway" },
  "microsoft.network/localnetworkgateways": { kind: "gateway", serviceFamily: "network", label: "Local Network Gateway" },
  "microsoft.network/privatednszones": { kind: "dns", serviceFamily: "network", label: "Private DNS Zone" },
  "microsoft.compute/virtualmachines": { kind: "vm", serviceFamily: "compute", label: "Virtual Machine" },
  "microsoft.compute/virtualmachinescalesets": { kind: "vmss", serviceFamily: "compute", label: "VM Scale Set" },
  "microsoft.compute/disks": { kind: "disk", serviceFamily: "compute", label: "Disk" },
  "microsoft.containerservice/managedclusters": { kind: "aks", serviceFamily: "containers", label: "AKS Cluster" },
  "microsoft.web/sites": { kind: "appService", serviceFamily: "app", label: "App Service" },
  "microsoft.web/serverfarms": { kind: "appPlan", serviceFamily: "app", label: "App Service Plan" },
  "microsoft.storage/storageaccounts": { kind: "storage", serviceFamily: "data", label: "Storage Account" },
  "microsoft.keyvault/vaults": { kind: "keyVault", serviceFamily: "security", label: "Key Vault" },
  "microsoft.sql/servers": { kind: "sql", serviceFamily: "data", label: "SQL Server" },
  "microsoft.sql/managedinstances": { kind: "sql", serviceFamily: "data", label: "Managed SQL Instance" },
  "microsoft.dbforpostgresql/flexibleservers": { kind: "database", serviceFamily: "data", label: "PostgreSQL Flexible Server" },
  "microsoft.dbformysql/flexibleservers": { kind: "database", serviceFamily: "data", label: "MySQL Flexible Server" },
  "microsoft.servicebus/namespaces": { kind: "messaging", serviceFamily: "integration", label: "Service Bus Namespace" },
  "microsoft.eventhub/namespaces": { kind: "messaging", serviceFamily: "integration", label: "Event Hub Namespace" },
  "microsoft.eventgrid/topics": { kind: "messaging", serviceFamily: "integration", label: "Event Grid Topic" },
  "microsoft.logic/workflows": { kind: "integration", serviceFamily: "integration", label: "Logic App Workflow" },
  "microsoft.app/containerapps": { kind: "containerApp", serviceFamily: "containers", label: "Container App" },
  "microsoft.app/jobs": { kind: "containerApp", serviceFamily: "containers", label: "Container App Job" },
  "microsoft.app/managedenvironments": { kind: "containerEnv", serviceFamily: "containers", label: "Managed Environment" },
  "microsoft.appconfiguration/configurationstores": { kind: "app", serviceFamily: "app", label: "App Configuration" },
  "microsoft.appplatform/spring": { kind: "app", serviceFamily: "app", label: "Spring Apps" },
  "microsoft.apimanagement/service": { kind: "integration", serviceFamily: "integration", label: "API Management" },
  "microsoft.insights/components": { kind: "monitoring", serviceFamily: "operations", label: "Application Insights" },
  "microsoft.insights/actiongroups": { kind: "operations", serviceFamily: "operations", label: "Action Group" },
  "microsoft.insights/metricalerts": { kind: "operations", serviceFamily: "operations", label: "Metric Alert" },
  "microsoft.insights/activitylogalerts": { kind: "operations", serviceFamily: "operations", label: "Activity Log Alert" },
  "microsoft.insights/datacollectionrules": { kind: "operations", serviceFamily: "operations", label: "Data Collection Rule" },
  "microsoft.insights/datacollectionendpoints": { kind: "operations", serviceFamily: "operations", label: "Data Collection Endpoint" },
  "microsoft.insights/workbooks": { kind: "operations", serviceFamily: "operations", label: "Workbook" },
  "microsoft.insights/webtests": { kind: "operations", serviceFamily: "operations", label: "Web Test" },
  "microsoft.insights/privatelinkscopes": { kind: "operations", serviceFamily: "operations", label: "Private Link Scope" },
  "microsoft.operationalinsights/workspaces": { kind: "monitoring", serviceFamily: "operations", label: "Log Analytics Workspace" },
  "microsoft.operationalinsights/querypacks": { kind: "operations", serviceFamily: "operations", label: "Query Pack" },
  "microsoft.monitor/accounts": { kind: "operations", serviceFamily: "operations", label: "Azure Monitor Workspace" },
  "microsoft.alertsmanagement/actionrules": { kind: "operations", serviceFamily: "operations", label: "Alert Processing Rule" },
  "microsoft.alertsmanagement/prometheusrulegroups": { kind: "operations", serviceFamily: "operations", label: "Prometheus Rule Group" },
  "microsoft.alertsmanagement/smartdetectoralertrules": { kind: "operations", serviceFamily: "operations", label: "Smart Detector Alert" },
  "microsoft.machinelearningservices/workspaces": { kind: "ai", serviceFamily: "ai", label: "Machine Learning Workspace" },
  "microsoft.cognitiveservices/accounts": { kind: "ai", serviceFamily: "ai", label: "Azure AI Account" },
  "microsoft.purview/accounts": { kind: "analytics", serviceFamily: "analytics", label: "Purview Account" },
  "microsoft.databricks/workspaces": { kind: "analytics", serviceFamily: "analytics", label: "Databricks Workspace" },
  "microsoft.synapse/workspaces": { kind: "analytics", serviceFamily: "analytics", label: "Synapse Workspace" },
  "microsoft.synapse/workspaces/sqlpools": { kind: "analytics", serviceFamily: "analytics", label: "Synapse SQL Pool" },
  "microsoft.synapse/workspaces/bigdatapools": { kind: "analytics", serviceFamily: "analytics", label: "Synapse Spark Pool" },
  "microsoft.search/searchservices": { kind: "ai", serviceFamily: "ai", label: "AI Search" },
  "microsoft.web/sites/slots": { kind: "appService", serviceFamily: "app", label: "App Service Slot" },
  "microsoft.web/hostingenvironments": { kind: "app", serviceFamily: "app", label: "App Service Environment" },
  "microsoft.web/connections": { kind: "integration", serviceFamily: "integration", label: "API Connection" },
  "microsoft.web/connectiongateways": { kind: "integration", serviceFamily: "integration", label: "Connection Gateway" },
  "microsoft.web/staticsites": { kind: "app", serviceFamily: "app", label: "Static Web App" },
  "microsoft.sql/servers/databases": { kind: "database", serviceFamily: "data", label: "SQL Database" },
  "microsoft.sql/managedinstances/databases": { kind: "database", serviceFamily: "data", label: "Managed Instance Database" },
  "microsoft.recoveryservices/vaults": { kind: "recovery", serviceFamily: "operations", label: "Recovery Services Vault" },
};

const PROVIDER_FAMILY_MAP = {
  "microsoft.network": "network",
  "microsoft.compute": "compute",
  "microsoft.web": "app",
  "microsoft.app": "containers",
  "microsoft.containerservice": "containers",
  "microsoft.storage": "data",
  "microsoft.sql": "data",
  "microsoft.documentdb": "data",
  "microsoft.dbforpostgresql": "data",
  "microsoft.dbformysql": "data",
  "microsoft.keyvault": "security",
  "microsoft.security": "security",
  "microsoft.insights": "operations",
  "microsoft.operationalinsights": "operations",
  "microsoft.alertsmanagement": "operations",
  "microsoft.recoveryservices": "operations",
  "microsoft.servicebus": "integration",
  "microsoft.eventhub": "integration",
  "microsoft.eventgrid": "integration",
  "microsoft.logic": "integration",
  "microsoft.apimanagement": "integration",
  "microsoft.communication": "integration",
  "microsoft.datafactory": "analytics",
  "microsoft.synapse": "analytics",
  "microsoft.databricks": "analytics",
  "microsoft.machinelearningservices": "ai",
  "microsoft.cognitiveservices": "ai",
  "microsoft.managedidentity": "identity",
  "microsoft.azureactivedirectory": "identity",
};

const FAMILY_LABEL_MAP = {
  network: "Network",
  compute: "Compute",
  app: "Application",
  containers: "Containers",
  data: "Data",
  security: "Security",
  operations: "Operations",
  integration: "Integration",
  analytics: "Analytics",
  ai: "AI",
  identity: "Identity",
  resource: "Azure Resource",
};

export function describeResourceType(type) {
  const lower = String(type || "").toLowerCase();
  if (EXPLICIT_KIND_MAP[lower]) {
    return EXPLICIT_KIND_MAP[lower];
  }

  const [providerNamespace = "", ...segments] = lower.split("/");
  const serviceFamily = PROVIDER_FAMILY_MAP[providerNamespace] || "resource";
  const serviceSegment = segments[segments.length - 1] || "resource";

  return {
    kind: serviceFamily,
    serviceFamily,
    label: titleCase(serviceSegment),
  };
}

export function familyLabel(family) {
  return FAMILY_LABEL_MAP[family] || "Azure Resource";
}
