import type { linkedAccount } from "#api/platform/database/schema/index";

import type { LinkedAccount } from "../../domain/linked-account.entity.js";
import { LinkedAccounts } from "../../domain/linked-accounts.aggregate.js";

type LinkedAccountRow = Pick<
  typeof linkedAccount.$inferSelect,
  "id" | "provider" | "providerAccountId" | "password" | "createdAt" | "updatedAt"
>;

export function toLinkedAccounts(
  userId: string,
  rows: readonly LinkedAccountRow[],
): LinkedAccounts | null {
  if (rows.length === 0) {
    return null;
  }
  return LinkedAccounts.reconstitute({
    userId,
    accounts: rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      passwordHash: row.password,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  });
}

export function toLinkedAccountRow(
  userId: string,
  account: LinkedAccount,
): typeof linkedAccount.$inferInsert {
  return {
    id: account.id.value,
    userId,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    password: account.passwordHash,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
