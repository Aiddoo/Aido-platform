import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function cannotBlockSelf(): DomainException {
  return new DomainException(ErrorCode.BLOCK_2201);
}
