#!/usr/bin/env -S node
import { Migration, MigrationCLI, col, primaryKey } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/3b9e222613382cd6abc119c89f8788ebf13de46194261b3f24feda8eb7e0d8e9/contract";
import startContract from "../../snapshots/3b9e222613382cd6abc119c89f8788ebf13de46194261b3f24feda8eb7e0d8e9/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/d80a48c1b4fd73b119fb619b70af00372376bc8a129c34649ae5dea44df733cf/contract";
import endContract from "../../snapshots/d80a48c1b4fd73b119fb619b70af00372376bc8a129c34649ae5dea44df733cf/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: "public",
        table: "SubscriptionEventReceipt",
        columns: [
          col("eventId", "character varying(255)", {
            notNull: true,
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 255 } },
          }),
          col("eventType", "character varying(50)", {
            notNull: true,
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 50 } },
          }),
          col("processedAt", "timestamp(3)", {
            notNull: true,
            codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
          }),
          col("provider", "character varying(30)", {
            notNull: true,
            codecRef: { codecId: "sql/varchar@1", typeParams: { length: 30 } },
          }),
        ],
        constraints: [
          primaryKey(["provider", "eventId"], { name: "SubscriptionEventReceipt_pkey" }),
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
