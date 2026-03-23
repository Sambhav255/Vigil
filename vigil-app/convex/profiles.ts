import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

export const createProfile = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("profiles", {
      userId,
      displayName: args.displayName,
      watchlist: ["SPY", "QQQ", "BTC", "ETH", "NVDA", "TSLA", "GLD", "CL"],
      alertPreferences: {
        emailAlerts: false,
        severityThreshold: "high",
        assetFilter: [],
        mutedCategories: [],
      },
      dashboardLayout: {
        assetClassFilter: "all",
        threatSortBy: "severity",
      },
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    });
  },
});

export const updateWatchlist = mutation({
  args: { watchlist: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      watchlist: args.watchlist,
      lastActiveAt: Date.now(),
    });
  },
});

export const updateAlertPreferences = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      alertPreferences: args.alertPreferences,
      lastActiveAt: Date.now(),
    });
  },
});

export const updateDashboardLayout = mutation({
  args: {
    dashboardLayout: v.object({
      sectorFilter: v.optional(v.string()),
      assetClassFilter: v.string(),
      threatSortBy: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      dashboardLayout: args.dashboardLayout,
      lastActiveAt: Date.now(),
    });
  },
});
