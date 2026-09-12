import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaDiagnosticsLogged?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

if (process.env.VERCEL && process.env.NODE_ENV === "production" && !globalForPrisma.prismaDiagnosticsLogged) {
  globalForPrisma.prismaDiagnosticsLogged = true;
  const baseDiagnostics = {
    nodeEnv: process.env.NODE_ENV,
    vercel: true,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
  };

  console.info("[vercel-prisma-diagnostics]", JSON.stringify({
    ...baseDiagnostics,
    connectionStatus: process.env.DATABASE_URL ? "lazy" : "DATABASE_URL_MISSING",
  }));
}
