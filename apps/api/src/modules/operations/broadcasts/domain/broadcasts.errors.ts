import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export function broadcastNotDistributing(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    reason: "분배 중인 캠페인만 페이지를 기록할 수 있습니다",
  });
}

export function broadcastContentEmpty(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, {
    reason: "브로드캐스트 제목/본문은 비어 있을 수 없습니다",
  });
}

export function invalidBroadcastDelivery(): DomainException {
  return new DomainException(ErrorCode.SYS_0002, { field: "delivery" });
}
