#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/b7363b9cbcc3e19fc5d4f3b50a48752ff682e0397f7f39e1d149c4852755b89e/contract";
import endContract from "../../snapshots/b7363b9cbcc3e19fc5d4f3b50a48752ff682e0397f7f39e1d149c4852755b89e/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/f6ddc403715cbed1bb758faaaf4d951d50cd301fa6c2364c31f4e54d0b0e584f/contract";
import startContract from "../../snapshots/f6ddc403715cbed1bb758faaaf4d951d50cd301fa6c2364c31f4e54d0b0e584f/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addNativeEnumValue({
        schema: "public",
        typeName: "NotificationType",
        value: "INVITE_PROGRESS",
      }),
      this.addNativeEnumValue({
        schema: "public",
        typeName: "NotificationType",
        value: "INVITE_QUALIFY_REMINDER",
      }),
      this.addColumn({
        schema: "public",
        table: "InviteRedemption",
        column: col("qualifyReminderSentAt", "timestamp(3)", {
          codecRef: { codecId: "pg/timestamp-string@1", typeParams: { precision: 3 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
