import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

export const saveThreat = mutation({
  args: {
    threatId: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("savedThreats")
      .withIndex("by_userId_threatId", (q) =>
        q.eq("userId", userId).eq("threatId", args.threatId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { note: args.note });
      return existing._id;
    }

    return await ctx.db.insert("savedThreats", {
      userId,
      threatId: args.threatId,
      note: args.note,
      savedAt: Date.now(),
    });
  },
});

export const getMySavedThreats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("savedThreats")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const removeSavedThreat = mutation({
  args: { threatId: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("savedThreats")
      .withIndex("by_userId_threatId", (q) =>
        q.eq("userId", userId).eq("threatId", args.threatId)
      )
      .first();

    if (existing) await ctx.db.delete(existing._id);
  },
});
