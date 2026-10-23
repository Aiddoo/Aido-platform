#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/4ccdcd5a92f1c8b30bb308ef451fd1c60a1a9582aef001c9cd3cae82c5e0485f/contract";
import endContract from "../../snapshots/4ccdcd5a92f1c8b30bb308ef451fd1c60a1a9582aef001c9cd3cae82c5e0485f/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/f2857cfc9b7e02a72cf16b6ddbc77fcc91f7368ed0b1f57e96ad5da5e7a9925f/contract";
import startContract from "../../snapshots/f2857cfc9b7e02a72cf16b6ddbc77fcc91f7368ed0b1f57e96ad5da5e7a9925f/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: "public",
        table: "PushDeliveryAttempt",
        column: col("tokenFingerprint", "character varying(64)", {
          codecRef: { codecId: "sql/varchar@1", typeParams: { length: 64 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
