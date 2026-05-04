import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL?.includes("prisma+postgres")
  ? process.env.DATABASE_URL.replace("prisma+postgres", "postgres").split("?api_key=")[0]
  : process.env.DATABASE_URL;

// For prisma+postgres URL, extract the actual postgres URL from the base64 api_key
function getPostgresUrl(): string {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("prisma+postgres")) {
    // The api_key is base64-encoded JSON containing the real database URL
    const apiKey = new URL(url.replace("prisma+postgres", "http")).searchParams.get("api_key");
    if (apiKey) {
      const decoded = JSON.parse(Buffer.from(apiKey, "base64").toString());
      return decoded.databaseUrl;
    }
  }
  return url;
}

const adapter = new PrismaPg({ connectionString: getPostgresUrl() });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (new (PrismaClient as any)({ adapter }) as PrismaClient);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
