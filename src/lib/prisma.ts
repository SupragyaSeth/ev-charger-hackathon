import { PrismaClient as AuthPrismaClient } from "@/generated/prisma/auth/client";
import { PrismaClient as QueuePrismaClient } from "@/generated/prisma/queue/client";

declare global {
  // eslint-disable-next-line no-var
  var authPrisma: AuthPrismaClient | undefined;
  // eslint-disable-next-line no-var
  var queuePrisma: QueuePrismaClient | undefined;
}

// Auth database client
export const authPrisma = globalThis.authPrisma ?? new AuthPrismaClient();

// Queue database client
export const queuePrisma = globalThis.queuePrisma ?? new QueuePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.authPrisma = authPrisma;
  globalThis.queuePrisma = queuePrisma;
}
