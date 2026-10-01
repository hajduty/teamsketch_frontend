// Built-in shapes for plot mode and the library: system design building blocks.

export type Outline =
  | "rect" | "round" | "stack" | "cylinder" | "bucket" | "hexagon" | "circle" | "cloud"
  | "diamond" | "parallelogram" | "queue" | "browser" | "phone" | "actor" | "note" | "boundary";

export interface AssetCategory {
  id: string;
  name: string;
  color: string;
}

export interface AssetDef {
  id: string;
  name: string;
  category: string;
  outline: Outline;
  // Material Symbols ligature drawn inside the shape
  icon?: string;
  width: number;
  height: number;
}

export const CATEGORIES: AssetCategory[] = [
  { id: "compute", name: "Compute", color: "#3b82f6" },
  { id: "data", name: "Data", color: "#22c55e" },
  { id: "network", name: "Networking", color: "#a855f7" },
  { id: "messaging", name: "Messaging", color: "#f59e0b" },
  { id: "clients", name: "Clients", color: "#0ea5e9" },
  { id: "basic", name: "Basic shapes", color: "#9a9ca5" },
];

export const ASSETS: AssetDef[] = [
  { id: "server", name: "Server", category: "compute", outline: "rect", icon: "dns", width: 140, height: 84 },
  { id: "service", name: "Service", category: "compute", outline: "round", icon: "settings", width: 140, height: 84 },
  { id: "container", name: "Container", category: "compute", outline: "rect", icon: "deployed_code", width: 140, height: 84 },
  { id: "function", name: "Function", category: "compute", outline: "round", icon: "bolt", width: 140, height: 84 },
  { id: "vm", name: "Virtual machine", category: "compute", outline: "rect", icon: "memory", width: 140, height: 84 },
  { id: "cluster", name: "Cluster", category: "compute", outline: "stack", icon: "hub", width: 150, height: 92 },

  { id: "sql", name: "SQL database", category: "data", outline: "cylinder", icon: "database", width: 116, height: 110 },
  { id: "nosql", name: "NoSQL database", category: "data", outline: "cylinder", icon: "data_object", width: 116, height: 110 },
  { id: "cache", name: "Cache", category: "data", outline: "cylinder", icon: "speed", width: 116, height: 110 },
  { id: "warehouse", name: "Data warehouse", category: "data", outline: "cylinder", icon: "warehouse", width: 116, height: 110 },
  { id: "bucket", name: "Object storage", category: "data", outline: "bucket", icon: "inventory_2", width: 120, height: 104 },
  { id: "search", name: "Search index", category: "data", outline: "rect", icon: "manage_search", width: 140, height: 84 },

  { id: "loadbalancer", name: "Load balancer", category: "network", outline: "circle", icon: "call_split", width: 104, height: 104 },
  { id: "gateway", name: "API gateway", category: "network", outline: "hexagon", icon: "api", width: 150, height: 92 },
  { id: "proxy", name: "Reverse proxy", category: "network", outline: "hexagon", icon: "swap_horiz", width: 150, height: 92 },
  { id: "cdn", name: "CDN", category: "network", outline: "cloud", icon: "public", width: 150, height: 96 },
  { id: "dns", name: "DNS", category: "network", outline: "circle", icon: "language", width: 104, height: 104 },
  { id: "firewall", name: "Firewall", category: "network", outline: "rect", icon: "shield", width: 140, height: 84 },

  { id: "queue", name: "Message queue", category: "messaging", outline: "queue", icon: "mail", width: 160, height: 80 },
  { id: "topic", name: "Pub/sub topic", category: "messaging", outline: "parallelogram", icon: "campaign", width: 160, height: 80 },
  { id: "stream", name: "Event stream", category: "messaging", outline: "parallelogram", icon: "stream", width: 160, height: 80 },
  { id: "scheduler", name: "Scheduler", category: "messaging", outline: "round", icon: "schedule", width: 140, height: 84 },
  { id: "webhook", name: "Webhook", category: "messaging", outline: "round", icon: "webhook", width: 140, height: 84 },

  { id: "user", name: "User", category: "clients", outline: "actor", width: 76, height: 116 },
  { id: "web", name: "Web app", category: "clients", outline: "browser", icon: "web", width: 150, height: 100 },
  { id: "mobile", name: "Mobile app", category: "clients", outline: "phone", icon: "smartphone", width: 76, height: 124 },
  { id: "external", name: "External service", category: "clients", outline: "cloud", icon: "cloud", width: 150, height: 96 },
  { id: "thirdparty", name: "Third-party API", category: "clients", outline: "round", icon: "extension", width: 140, height: 84 },

  { id: "box", name: "Box", category: "basic", outline: "rect", width: 140, height: 84 },
  { id: "roundbox", name: "Rounded box", category: "basic", outline: "round", width: 140, height: 84 },
  { id: "circle", name: "Circle", category: "basic", outline: "circle", width: 100, height: 100 },
  { id: "decision", name: "Decision", category: "basic", outline: "diamond", width: 140, height: 100 },
  { id: "note", name: "Note", category: "basic", outline: "note", width: 150, height: 110 },
  { id: "boundary", name: "Boundary", category: "basic", outline: "boundary", width: 360, height: 240 },
];

const BY_ID = new Map(ASSETS.map(asset => [asset.id, asset]));
const CATEGORY_BY_ID = new Map(CATEGORIES.map(category => [category.id, category]));

export const getAsset = (id: string | undefined) => (id ? BY_ID.get(id) : undefined);
export const getCategory = (id: string | undefined) => (id ? CATEGORY_BY_ID.get(id) : undefined);
export const assetsIn = (categoryId: string) => ASSETS.filter(asset => asset.category === categoryId);
export const categoryColor = (asset: AssetDef) => getCategory(asset.category)?.color ?? "#9a9ca5";
