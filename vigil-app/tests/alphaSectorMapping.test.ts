import { describe, expect, it } from "vitest";
import { mapAlphaOverviewToVigilSectors } from "@/lib/asset/alphaSectorMapping";

describe("mapAlphaOverviewToVigilSectors", () => {
  it("maps Technology -> Technology", () => {
    const sectors = mapAlphaOverviewToVigilSectors({
      sector: "Technology",
      industry: "Semiconductors",
      assetType: "Common Stock",
      symbol: "NVDA",
    });
    expect(sectors).toContain("Technology");
  });

  it("maps Financial Services -> Finance", () => {
    const sectors = mapAlphaOverviewToVigilSectors({
      sector: "Financial Services",
      industry: "Banks",
      assetType: "Common Stock",
      symbol: "JPM",
    });
    expect(sectors).toContain("Finance");
  });

  it("maps Energy -> Energy", () => {
    const sectors = mapAlphaOverviewToVigilSectors({
      sector: "Energy",
      industry: "Oil & Gas",
      assetType: "Common Stock",
      symbol: "XOM",
    });
    expect(sectors).toContain("Energy");
  });

  it("maps defense keywords -> Defense", () => {
    const sectors = mapAlphaOverviewToVigilSectors({
      sector: "Industrials",
      industry: "Aerospace & Defense",
      assetType: "Common Stock",
      symbol: "LMT",
    });
    expect(sectors).toContain("Defense");
  });

  it("maps Basic Materials / metals -> Commodities", () => {
    const sectors = mapAlphaOverviewToVigilSectors({
      sector: "Basic Materials",
      industry: "Gold",
      assetType: "Common Stock",
      symbol: "GLD",
    });
    expect(sectors).toContain("Commodities");
  });

  it("defaults to Technology for unknown sectors", () => {
    const sectors = mapAlphaOverviewToVigilSectors({
      sector: "Unknown Sector",
      industry: "Unknown Industry",
      assetType: "Common Stock",
      symbol: "FOO",
    });
    expect(sectors).toEqual(["Technology"]);
  });
});

