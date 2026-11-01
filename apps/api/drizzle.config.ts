import { defineConfig } from "drizzle-kit";

import { assertDatabaseUrlIsSafe } from "./scripts/guard-database-url.cjs";

const url =
  process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";
assertDatabaseUrlIsSafe(url);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/platform/database/schema/tables.schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  schemaFilter: ["public"],
});
