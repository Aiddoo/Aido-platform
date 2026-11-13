import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function adminNoticeTitleEmpty(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    field: "title",
    reason: "관리자 알림 제목은 비어 있을 수 없습니다",
  });
}

export function adminNoticeBodyEmpty(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    field: "body",
    reason: "관리자 알림 본문은 비어 있을 수 없습니다",
  });
}
