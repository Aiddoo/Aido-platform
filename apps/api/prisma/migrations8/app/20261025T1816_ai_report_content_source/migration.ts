#!/usr/bin/env -S node
import { Migration, MigrationCLI, col } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/2d0bd9f2511c9fe5cc36615ed91cf7f2563d55bd42519338e2887d4a066cdf3a/contract";
import startContract from "../../snapshots/2d0bd9f2511c9fe5cc36615ed91cf7f2563d55bd42519338e2887d4a066cdf3a/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/7b8526bf044b260f280658451ee0b37bf37357e57843db9aa770586b367914dc/contract";
import endContract from "../../snapshots/7b8526bf044b260f280658451ee0b37bf37357e57843db9aa770586b367914dc/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: "public",
        table: "AiReport",
        column: col("contentSource", "character varying(16)", {
          codecRef: { codecId: "sql/varchar@1", typeParams: { length: 16 } },
        }),
      }),
      this.addColumn({
        schema: "public",
        table: "AiReport",
        column: col("promptVersion", "character varying(40)", {
          codecRef: { codecId: "sql/varchar@1", typeParams: { length: 40 } },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
