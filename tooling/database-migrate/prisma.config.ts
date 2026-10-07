import { resolve } from 'node:path';

import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig } from '@prisma/orm-postgres/config';

import { assertDatabaseUrlIsSafe } from '../../apps/api/scripts/guard-database-url.cjs';

const url =
  process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
assertDatabaseUrlIsSafe(url);
const apiDirectory = resolve(import.meta.dirname, '../../apps/api');

export default definePrismaConfig({
  orm: defineConfig({
    contract: resolve(apiDirectory, 'src/prisma/contract.prisma'),
    output: resolve(apiDirectory, 'src/generated/prisma8'),
    migrations: { dir: resolve(apiDirectory, 'prisma/migrations8') },
    db: { connection: url },
  }),
});
