import { NotificationRecipientPreferenceReaderPort } from "#api/modules/notification/push/application/ports/notification-recipient-preference.reader.port";
import type { NotificationDeliveryPreference } from "#api/modules/notification/push/application/ports/user-notification-settings.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createNotificationDeliveryPreferenceFixture } from "#test/fixtures/notification/notification-delivery-preference.fixture";

// 등록하지 않은 사용자는 기본 수신 설정으로 답한다(실제 reader도 행이 없으면 기본값을 준다)
export class StubNotificationRecipientPreferenceReader extends NotificationRecipientPreferenceReaderPort {
  readonly preferences = new Map<string, NotificationDeliveryPreference>();

  async getPreference(user: UserId): Promise<NotificationDeliveryPreference> {
    const userId = user.value;
    return this.preferences.get(userId) ?? createNotificationDeliveryPreferenceFixture();
  }
}
