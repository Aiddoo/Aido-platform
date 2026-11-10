import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
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

  async findUsersInQuietHours(
    users: readonly UserId[],
    instant: Temporal.Instant,
  ): Promise<ReadonlySet<string>> {
    if (users.length === 0) {
      return new Set();
    }

    const userIds = users.map((user) => user.value);
    const preferences = await this.#dependencies.userSettings.getPreferenceRecordsByUserIds(users);
    const timezones = new Map(
      preferences.map((preference) => [preference.userId, preference.timezone]),
    );
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
