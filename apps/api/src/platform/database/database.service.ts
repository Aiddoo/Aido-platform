import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import postgres from "@prisma/orm-postgres/runtime";

import type { Contract } from "../../generated/prisma8/contract.d.js";
import contractJson from "../../generated/prisma8/contract.json" with { type: "json" };
import { utcTimestampParameters } from "./database-timestamp.middleware.js";
import { PostgresPool } from "./postgres-pool.js";

/** PostgreSQL contract와 native Prisma ORM의 수명주기를 소유한다. */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly db;

  constructor(pool: PostgresPool) {
    this.db = postgres<Contract>({
      contractJson,
      pg: pool.pool,
      middleware: [utcTimestampParameters],
    });
  }

  async onApplicationShutdown() {
    await this.db.close();
  }
}
