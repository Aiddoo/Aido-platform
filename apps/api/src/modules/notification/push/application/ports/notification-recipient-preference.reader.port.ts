import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationDeliveryPreference } from "./user-notification-settings.port.js";

// 단건 알림 전달에 쓰는 수신자 설정(기본값·캐시 일관성 포함)
export abstract class NotificationRecipientPreferenceReaderPort {
  abstract getPreference(userId: UserId): Promise<NotificationDeliveryPreference>;
}
