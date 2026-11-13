import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function suggestionAlreadyHandled(
  suggestionId: number,
  currentStatus: string,
): DomainException {
  return new DomainException(ErrorCode.AI_1306, { suggestionId, currentStatus });
}

export function suggestionExpired(suggestionId: number): DomainException {
  return new DomainException(ErrorCode.AI_1307, { suggestionId });
}
