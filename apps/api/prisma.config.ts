import { resolve } from "node:path";

import { definePrismaConfig } from "@prisma/cli-engine";
import { defineConfig } from "@prisma/orm-postgres/config";

import { assertDatabaseUrlIsSafe } from "./scripts/guard-database-url.cjs";

const url =
	process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";
assertDatabaseUrlIsSafe(url);

export default definePrismaConfig({
	orm: defineConfig({
		contract: resolve(import.meta.dirname, "src/prisma/contract.prisma"),
		migrations: { dir: resolve(import.meta.dirname, "prisma/migrations8") },
		output: resolve(import.meta.dirname, "src/generated/prisma8"),
		db: { connection: url },
	}),
});
