import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn, resolveDeliveryTimezone } from "#api/shared/domain/time/time-zone-name";

import type { NotificationDeliveryPreference } from "../../../shared/application/ports/user-notification-settings.port.js";
import type { NotificationRecipientPreferenceReaderPort } from "../ports/notification-recipient-preference.reader.port.js";

export interface SinglePushDeliveryRecipient {
  readonly userId: string;
  readonly preference: NotificationDeliveryPreference;
  readonly timezone: string;
  // 발송 판단의 현지 날짜(YYYY-MM-DD)는 rate limit·발송 context 키로 쓴다
  readonly localDate: string;
}

interface LoadPushDeliveryRecipientDependencies {
  readonly recipientPreferenceReader: Pick<
    NotificationRecipientPreferenceReaderPort,
    "getPreference"
  >;
  readonly clock: ClockPort;
}

// 단건 발송은 캐시한 수신자 설정 하나로 판단한다
export class LoadPushDeliveryRecipientUseCase {
  readonly #dependencies: LoadPushDeliveryRecipientDependencies;

  constructor(dependencies: LoadPushDeliveryRecipientDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string): Promise<SinglePushDeliveryRecipient> {
    const preference = await this.#dependencies.recipientPreferenceReader.getPreference(
      UserId.reconstitute(userId),
    );
    const timezone = resolveDeliveryTimezone(preference.timezone);
    return {
      userId,
      preference,
      timezone,
      localDate: localDateIn(this.#dependencies.clock.now(), timezone).toString(),
    };
  }
}
