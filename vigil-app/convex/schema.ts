import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // User profiles (extends the auth users table)
  profiles: defineTable({
    userId: v.id("users"),
    displayName: v.string(),
    watchlist: v.array(v.string()), // ticker symbols: ["NVDA", "BTC", "SPY"]
    alertPreferences: v.object({
      emailAlerts: v.boolean(),
      severityThreshold: v.union(
        v.literal("critical"),
        v.literal("high"),
        v.literal("medium"),
        v.literal("low")
      ),
      assetFilter: v.array(v.string()),
      mutedCategories: v.array(v.string()),
    }),
    dashboardLayout: v.object({
      sectorFilter: v.optional(v.string()),
      assetClassFilter: v.string(),
      threatSortBy: v.string(),
    }),
    createdAt: v.number(),
    lastActiveAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Hit-rate validation logging
  alertLog: defineTable({
    userId: v.optional(v.id("users")),
    threatId: v.string(),
    threatTitle: v.string(),
    asset: v.string(),
    direction: v.string(),
    compositeScore: v.number(),
    probability: v.number(),
    probSource: v.string(),
    category: v.string(),
    severity: v.string(),
    assetPriceAtAlert: v.number(),
    priceAt1h: v.optional(v.number()),
    priceAt4h: v.optional(v.number()),
    priceAt24h: v.optional(v.number()),
    priceAt7d: v.optional(v.number()),
    wasCorrect: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_asset", ["asset"]),

  // User-saved threat notes
  savedThreats: defineTable({
    userId: v.id("users"),
    threatId: v.string(),
    note: v.optional(v.string()),
    savedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_threatId", ["userId", "threatId"]),
});
