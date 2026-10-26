#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/25a298177abe0e66aa900d36082a6430355b06c939ff743834cd3b72d2925269/contract";
import endContract from "../../snapshots/25a298177abe0e66aa900d36082a6430355b06c939ff743834cd3b72d2925269/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/c1bc913538dc23341da824490c0b696811c382ea9969e77212c0b003b70e5533/contract";
import startContract from "../../snapshots/c1bc913538dc23341da824490c0b696811c382ea9969e77212c0b003b70e5533/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: "public",
        table: "UserReport",
        column: col("resolutionNote", "character varying(500)", {
          codecRef: { codecId: "sql/varchar@1", typeParams: { length: 500 } },
        }),
      }),
      this.addColumn({
        schema: "public",
        table: "UserReport",
        column: col("resolvedAt", "timestamp(3)", {
          codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: "public",
        table: "UserReport",
        column: col("resolvedById", "text", { codecRef: { codecId: "pg/text@1" } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
