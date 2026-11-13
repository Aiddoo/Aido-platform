import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function storeSubscriptionIdMissing(): DomainException {
  return new DomainException(ErrorCode.SUBSCRIPTION_1604, {
    reason: "Missing store subscription id",
  });
}
