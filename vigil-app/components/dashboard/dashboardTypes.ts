export type Snapshot = Awaited<ReturnType<typeof import("@/lib/pipeline").buildDashboardSnapshot>>;
export type Threat = Snapshot["threats"][0];

export type AssetFilter = "all" | "stocks" | "crypto" | "commodities";
export type ViewMode = "dashboard" | "portfolio";

export type AssetMeta = { name?: string | null; sectors: string[] };

