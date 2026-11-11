import type { TransactionalAdapterDrizzleOrm } from "@nestjs-cls/transactional-adapter-drizzle-orm";
import type { Logger } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";

import { relations } from "./schema/index.js";

// 업무 포트가 아니라 Drizzle 클라이언트 인스턴스라 Symbol 토큰으로 둔다(infrastructure 어댑터만 주입받는다)
export const DRIZZLE = Symbol("DRIZZLE");

export function createDatabase(pool: Pool, logger?: Logger) {
  return drizzle({ client: pool, relations, logger });
}

export type Database = ReturnType<typeof createDatabase>;
export type DrizzleTransactionalAdapter = TransactionalAdapterDrizzleOrm<Database>;
