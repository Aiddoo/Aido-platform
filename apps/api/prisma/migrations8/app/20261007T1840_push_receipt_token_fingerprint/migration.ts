#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/5eefdf63886315410d0378bf753a05f415396e235f83795390bd693cec24dd95/contract";
import endContract from "../../snapshots/5eefdf63886315410d0378bf753a05f415396e235f83795390bd693cec24dd95/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/d80a48c1b4fd73b119fb619b70af00372376bc8a129c34649ae5dea44df733cf/contract";
import startContract from "../../snapshots/d80a48c1b4fd73b119fb619b70af00372376bc8a129c34649ae5dea44df733cf/contract.json" with { type: "json" };

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
