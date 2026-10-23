import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";

import type { Contract } from "../../generated/prisma8/contract.d.js";
import contractJson from "../../generated/prisma8/contract.json" with { type: "json" };
import { PostgresPool } from "./postgres-pool.js";

export const contract = contractFromJson<Contract>(contractJson);

/** PostgreSQL contract와 native Prisma ORM의 수명주기를 소유한다. */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly db;

  constructor(pool: PostgresPool) {
    this.db = postgres({
      contract,
      pg: pool.pool,
    });
  }

  async onApplicationShutdown() {
    await this.db.close();
  }
}
