import type { NOTIFICATION_PURPOSES } from "@aido/api/vocabulary";

import type { NotificationType } from "../../inbox/domain/notification-type.constants.js";
import { isMarketingNotification } from "./push-eligibility.domain-service.js";

export const PUSH_DELIVERY_LANES = ["TRANSACTIONAL", "MARKETING"] as const;
export type PushDeliveryLane = (typeof PUSH_DELIVERY_LANES)[number];

export interface PushDeliveryLaneSource {
  readonly purpose: (typeof NOTIFICATION_PURPOSES)[number];
  readonly type: NotificationType;
}

// 관리자 브로드캐스트는 purpose가 TRANSACTIONAL이어도 대량 발송이라 리마인더를 밀어내지 않게 마케팅 차선으로 보낸다
export function pushDeliveryLaneOf(source: PushDeliveryLaneSource): PushDeliveryLane {
  if (
    source.purpose === "ENGAGEMENT" ||
    source.type === "ADMIN_BROADCAST" ||
    isMarketingNotification(source.type)
  ) {
    return "MARKETING";
  }
  return "TRANSACTIONAL";
}
