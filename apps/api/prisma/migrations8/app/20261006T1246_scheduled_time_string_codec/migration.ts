#!/usr/bin/env -S node
import { Migration, MigrationCLI } from "@prisma/orm-postgres/migration";

import type { Contract as End } from "../../snapshots/3b9e222613382cd6abc119c89f8788ebf13de46194261b3f24feda8eb7e0d8e9/contract.d.js";
import endContract from "../../snapshots/3b9e222613382cd6abc119c89f8788ebf13de46194261b3f24feda8eb7e0d8e9/contract.json" with { type: "json" };
import type { Contract as Start } from "../../snapshots/dc63ea58b2c07a750ff5d49f7003d6feb577625730bbf2dbd0d36805090f926e/contract.d.js";
import startContract from "../../snapshots/dc63ea58b2c07a750ff5d49f7003d6feb577625730bbf2dbd0d36805090f926e/contract.json" with { type: "json" };

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
