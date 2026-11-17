import type { linkedAccount } from "#api/platform/database/schema/index";

import type { LinkedAccountReadModel } from "../../application/ports/linked-accounts.repository.port.js";
import { LinkedAccounts } from "../../domain/linked-accounts.aggregate.js";

type AccountRow = Pick<
  typeof linkedAccount.$inferSelect,
  "id" | "provider" | "providerAccountId" | "createdAt"
>;

export function toLinkedAccountReadModel(
  row: Pick<
    typeof linkedAccount.$inferSelect,
    "id" | "userId" | "provider" | "providerAccountId" | "password" | "createdAt"
  >,
): LinkedAccountReadModel {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerAccountId: row.providerAccountId,
    password: row.password,
    createdAt: row.createdAt,
  };
}

export function toLinkedAccounts(userId: string, rows: readonly AccountRow[]): LinkedAccounts {
  return LinkedAccounts.reconstitute({
    userId,
    accounts: rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      createdAt: row.createdAt,
    })),
  });
}
