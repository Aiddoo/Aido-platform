import type { LinkedAccountsResponse } from "@aido/api/contracts/auth";

import { toIsoString } from "#api/shared/domain/time/instant";

import type { LinkedAccountListReadModel } from "../../../application/use-cases/list-linked-accounts.use-case.js";

export function toLinkedAccountsResponse(
  result: LinkedAccountListReadModel,
): LinkedAccountsResponse {
  return {
    accounts: result.accounts.map((account) => ({
      ...account,
      linkedAt: account.linkedAt == null ? null : toIsoString(account.linkedAt),
    })),
    canUnlink: result.canUnlink,
  };
}
