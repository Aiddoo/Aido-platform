import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function emailRecipientMissing(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "to" });
}

export function emailSubjectMissing(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "subject" });
}
