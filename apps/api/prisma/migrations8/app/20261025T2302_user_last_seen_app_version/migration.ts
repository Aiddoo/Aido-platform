#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/d7337e196b6e82406b48fd5b019129c1e7faf12b04b3e385070f9280c019592a/contract";
import startContract from "../../snapshots/d7337e196b6e82406b48fd5b019129c1e7faf12b04b3e385070f9280c019592a/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/f6ddc403715cbed1bb758faaaf4d951d50cd301fa6c2364c31f4e54d0b0e584f/contract";
import endContract from "../../snapshots/f6ddc403715cbed1bb758faaaf4d951d50cd301fa6c2364c31f4e54d0b0e584f/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: "public",
        table: "User",
        column: col("lastSeenAppVersion", "character varying(30)", {
          codecRef: { codecId: "sql/varchar@1", typeParams: { length: 30 } },
        }),
      }),
      this.addColumn({
        schema: "public",
        table: "User",
        column: col("lastSeenAppVersionAt", "timestamp(3)", {
          codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
