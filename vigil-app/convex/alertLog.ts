import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const logAlert = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    return await ctx.db.insert("alertLog", {
      userId: userId ?? undefined,
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updateAlertPrice = mutation({
  args: {
    alertId: v.id("alertLog"),
    field: v.union(
      v.literal("priceAt1h"),
      v.literal("priceAt4h"),
      v.literal("priceAt24h"),
      v.literal("priceAt7d")
    ),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.alertId, { [args.field]: args.price });
  },
});

export const getHitRateStats = query({
  args: {},
  handler: async (ctx) => {
    const alerts = await ctx.db
      .query("alertLog")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);

    const completed = alerts.filter((a) => a.priceAt24h !== undefined);
    if (completed.length === 0) return { hitRate: null, total: 0, correct: 0 };

    const correct = completed.filter((a) => {
      if (!a.priceAt24h || !a.assetPriceAtAlert) return false;
      const moved = a.priceAt24h - a.assetPriceAtAlert;
      if (a.direction === "bearish") return moved < 0;
      if (a.direction === "bullish") return moved > 0;
      return false;
    });

    return {
      hitRate: Math.round((correct.length / completed.length) * 100),
      total: completed.length,
      correct: correct.length,
    };
  },
});
