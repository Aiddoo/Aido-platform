import type { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import type { Logger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import { relations } from "./schema/index.js";

export const DRIZZLE = Symbol("DRIZZLE");

export function createDatabase(pool: Pool, logger?: Logger) {
  return drizzle({ client: pool, relations, logger });
}

export type Database = ReturnType<typeof createDatabase>;
export type DrizzleTransactionalAdapter = TransactionalAdapterDrizzleOrm<Database>;
