#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/25a298177abe0e66aa900d36082a6430355b06c939ff743834cd3b72d2925269/contract";
import startContract from "../../snapshots/25a298177abe0e66aa900d36082a6430355b06c939ff743834cd3b72d2925269/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/d7337e196b6e82406b48fd5b019129c1e7faf12b04b3e385070f9280c019592a/contract";
import endContract from "../../snapshots/d7337e196b6e82406b48fd5b019129c1e7faf12b04b3e385070f9280c019592a/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: "public",
        table: "UserConsent",
        column: col("aiDataSharingAgreedAt", "timestamp(3)", {
          codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: "public",
        table: "UserConsent",
        column: col("aiDataSharingVersion", "character varying(20)", {
          codecRef: { codecId: "sql/varchar@1", typeParams: { length: 20 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
