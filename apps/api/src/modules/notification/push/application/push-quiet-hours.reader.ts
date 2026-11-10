import { instantFromDate } from "#api/shared/domain/time/instant";
import { resolveDeliveryTimezone } from "#api/shared/domain/time/time-zone-name";
import { TimeZone } from "#api/shared/domain/time/time-zone.vo";

import {
  isWithinQuietHours,
  PUSH_QUIET_HOURS_WINDOW,
} from "../domain/quiet-hours.domain-service.js";
import type { PushQuietHoursReaderPort } from "./ports/push-quiet-hours.reader.port.js";
import type { UserNotificationSettingsPort } from "./ports/user-notification-settings.port.js";

interface PushQuietHoursReaderDependencies {
  readonly userSettings: Pick<UserNotificationSettingsPort, "getPreferenceRecordsByUserIds">;
}

// 발송 경로와 같은 배송 시간대 해석과 야간 판정으로 사용자를 한 번에 고른다
export class PushQuietHoursReader implements PushQuietHoursReaderPort {
  readonly #dependencies: PushQuietHoursReaderDependencies;

  constructor(dependencies: PushQuietHoursReaderDependencies) {
    this.#dependencies = dependencies;
  }

  async findUsersInQuietHours(userIds: readonly string[], at: Date): Promise<ReadonlySet<string>> {
    if (userIds.length === 0) {
      return new Set();
    }

    const preferences = await this.#dependencies.userSettings.getPreferenceRecordsByUserIds([
      ...userIds,
    ]);
    const timezones = new Map(
      preferences.map((preference) => [preference.userId, preference.timezone]),
    );
    const instant = instantFromDate(at);
    return new Set(
      userIds.filter((userId) =>
        isWithinQuietHours({
          instant,
          timeZone: TimeZone.reconstitute(resolveDeliveryTimezone(timezones.get(userId))),
          window: PUSH_QUIET_HOURS_WINDOW,
        }),
      ),
    );
  }
}
