#!/usr/bin/env -S node
import { Migration, MigrationCLI } from "@prisma/orm-postgres/migration";

import type { Contract as Start } from "../../snapshots/02cf3188c73b240d4c94b0b71086038bde80ae635ade8c8a76fbe22202600146/contract.d.js";
import startContract from "../../snapshots/02cf3188c73b240d4c94b0b71086038bde80ae635ade8c8a76fbe22202600146/contract.json" with { type: "json" };
import type { Contract as End } from "../../snapshots/242a04c5aa8a763586e1bd3c57ffe283b32afea882c1ac530e7c01fd8fcdf970/contract.d.js";
import endContract from "../../snapshots/242a04c5aa8a763586e1bd3c57ffe283b32afea882c1ac530e7c01fd8fcdf970/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
