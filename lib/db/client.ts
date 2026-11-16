import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { SUPABASE_ROOT_2021_CA } from "./supabase-ca";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Without an explicit cap, pg.Pool opens up to 10 connections per process and
  // the adapter was only given the connection string. On serverless every warm
  // instance builds its own pool, so two of them already exceeded the 15
  // connections of Supabase's free session pooler — surfacing as Prisma's
  // "Can't reach database server", which reads like an outage rather than an
  // exhausted pool. The cap is per-environment: small on Vercel, a bit higher
  // on the worker, which is a single long-lived process.
  // Optional: verify Supabase's TLS chain against its published root CA.
  // node-postgres treats sslmode=require as full verification, which fails on
  // Supabase's private CA, and URL ssl params override the `ssl` option, so the
  // param is dropped from the URL when the CA is supplied here.
  const supabaseCa = process.env.DB_SSL_CA === "supabase-2021";
  const connectionString = supabaseCa
    ? databaseUrl.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "")
    : databaseUrl;

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      ...(supabaseCa ? { ssl: { ca: SUPABASE_ROOT_2021_CA } } : {}),
      max: Number(process.env.DB_POOL_MAX ?? 3),
      idleTimeoutMillis: 10_000,
    }, {
      // Optional: run in a non-public schema (e.g. sharing a Supabase project).
      schema: process.env.DB_SCHEMA || undefined,
    }),
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});
