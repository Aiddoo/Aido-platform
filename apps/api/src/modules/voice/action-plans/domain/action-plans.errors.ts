import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function planCategoriesNotOwned(categoryIds: readonly number[]): DomainException {
  return new DomainException(ErrorCode.AI_1315, { reason: "CATEGORY_NOT_OWNED", categoryIds });
}
