/**
 * Seed regions + countries from a Country/Region XLSX.
 *
 * Expects four columns in row 1: Country, Region, Region Short Name,
 * Country Short Name. Default file path is the EY mapping; pass another path
 * as the first arg.
 *
 * Idempotent — upserts by region.shortName and jurisdiction.code (ISO alpha-2).
 * Existing tiers are preserved; new rows default to `standard`.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function getPostgresUrl(): string {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("prisma+postgres")) {
    const apiKey = new URL(url.replace("prisma+postgres", "http")).searchParams.get("api_key");
    if (apiKey) {
      const decoded = JSON.parse(Buffer.from(apiKey, "base64").toString());
      return decoded.databaseUrl;
    }
  }
  return url;
}

const adapter = new PrismaPg({ connectionString: getPostgresUrl() });
const prisma = new (PrismaClient as any)({ adapter }) as PrismaClient;

const DEFAULT_PATH =
  "/Users/blkmrkt/Downloads/Countriy-Area-Region-RegionAbbreviateion-Mapping.xlsx";

interface Row {
  country: string;
  region: string;
  regionShort: string;
  countryShort: string;
}

async function readRows(path: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(path) as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error(`No sheets in ${path}`);

  const out: Row[] = [];
  let header: string[] | null = null;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value;
      cells.push(v == null ? "" : typeof v === "string" ? v : String(v));
    });
    if (!header) {
      header = cells.map((c) => c.trim().toLowerCase());
      return;
    }
    const r = header.reduce<Record<string, string>>((acc, h, i) => {
      acc[h] = (cells[i] ?? "").trim();
      return acc;
    }, {});
    if (!r["country"]) return;
    out.push({
      country: r["country"],
      region: r["region"],
      regionShort: r["region short name"],
      countryShort: r["country short name"],
    });
  });
  return out;
}

async function main() {
  const path = process.argv[2] ?? DEFAULT_PATH;
  console.log(`📋 Reading ${path}`);
  const rows = await readRows(path);
  console.log(`  Parsed ${rows.length} country rows`);

  // Distinct regions in file order (to keep "Global" last if it's last in file)
  const regionMap = new Map<string, { name: string; shortName: string; order: number }>();
  rows.forEach((r, i) => {
    if (!r.regionShort) return;
    if (!regionMap.has(r.regionShort)) {
      regionMap.set(r.regionShort, {
        name: r.region,
        shortName: r.regionShort,
        order: regionMap.size,
      });
    }
  });

  for (const r of regionMap.values()) {
    await prisma.region.upsert({
      where: { shortName: r.shortName },
      create: { name: r.name, shortName: r.shortName, displayOrder: r.order },
      update: { name: r.name, displayOrder: r.order },
    });
  }
  console.log(`✓ Seeded ${regionMap.size} regions`);

  const regionRows = await prisma.region.findMany();
  const regionByShort = new Map(regionRows.map((r) => [r.shortName, r.id]));

  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    if (!row.countryShort) continue;
    const code = row.countryShort.toUpperCase();
    const regionId = regionByShort.get(row.regionShort) ?? null;

    const existing = await prisma.jurisdiction.findUnique({ where: { code } });
    if (existing) {
      await prisma.jurisdiction.update({
        where: { code },
        data: { name: row.country, regionId },
      });
      updated++;
    } else {
      await prisma.jurisdiction.create({
        data: {
          code,
          name: row.country,
          tier: "standard",
          regionId,
        },
      });
      inserted++;
    }
  }
  console.log(`✓ Jurisdictions: ${inserted} inserted, ${updated} updated`);

  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
