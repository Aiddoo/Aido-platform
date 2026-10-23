#!/usr/bin/env -S node
import { Migration, MigrationCLI, col, primaryKey } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/242a04c5aa8a763586e1bd3c57ffe283b32afea882c1ac530e7c01fd8fcdf970/contract";
import startContract from "../../snapshots/242a04c5aa8a763586e1bd3c57ffe283b32afea882c1ac530e7c01fd8fcdf970/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/f2857cfc9b7e02a72cf16b6ddbc77fcc91f7368ed0b1f57e96ad5da5e7a9925f/contract";
import endContract from "../../snapshots/f2857cfc9b7e02a72cf16b6ddbc77fcc91f7368ed0b1f57e96ad5da5e7a9925f/contract.json" with { type: "json" };

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
