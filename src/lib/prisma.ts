import { PrismaClient } from "@prisma/client";

// Transient errors typical of serverless Postgres (Neon) when the compute is
// waking from scale-to-zero or the pooler drops an idle connection.
const TRANSIENT_CODES = new Set(["P1001", "P1002", "P1017"]);

function isTransientDbError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code && TRANSIENT_CODES.has(code)) {
    return true;
  }
  const message = String((error as { message?: string })?.message ?? "");
  // Note: deliberately does NOT match "Timed out fetching a new connection"
  // (P2024) — retrying pool exhaustion only makes it worse. We retry genuine
  // dropped/unreachable connections, which a Neon cold-start or idle-close
  // produces.
  return (
    message.includes("Can't reach database server") ||
    message.includes("Connection reset") ||
    message.includes("kind: Closed")
  );
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Retry transient connection failures transparently for every query, so a
  // Neon cold-start (or dropped idle connection) doesn't surface as a 500.
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        const maxAttempts = 4;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          try {
            return await query(args);
          } catch (error) {
            if (attempt === maxAttempts || !isTransientDbError(error)) {
              throw error;
            }
            // Exponential-ish backoff: 300ms, 700ms, 1.5s — enough for a
            // Neon compute to finish waking.
            await delay(200 * 2 ** attempt - 100);
          }
        }
        // Unreachable: the loop either returns or throws.
        throw new Error("prisma retry loop exhausted");
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
