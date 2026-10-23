#!/usr/bin/env -S node
import { Migration, MigrationCLI } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/4ccdcd5a92f1c8b30bb308ef451fd1c60a1a9582aef001c9cd3cae82c5e0485f/contract";
import startContract from "../../snapshots/4ccdcd5a92f1c8b30bb308ef451fd1c60a1a9582aef001c9cd3cae82c5e0485f/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a/contract";
import endContract from "../../snapshots/65d810f74acf51dc46d4ffa10564516809ad487555fff459995e1dee14e7695a/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
