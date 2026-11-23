import { SchedulerPreferenceReaderPort } from "#api/modules/notification/reminders/application/ports/scheduler-preference-reader.port";
import {
  type RecipientLocaleOf,
  recipientLocaleOf,
} from "#api/modules/notification/shared/domain/recipient-locale.domain-service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { normalizeIanaTimezone } from "#api/shared/domain/time/timezone-name";

interface StoredPreference {
  readonly timezone: string;
  readonly locale: string;
}

// 사용자 설정 행처럼 시간대·언어를 저장값 그대로 두고 Drizzle과 같은 규칙으로 읽는다
export class InMemorySchedulerPreferenceReader extends SchedulerPreferenceReaderPort {
  readonly #preferences = new Map<string, StoredPreference>();
  #sequence = 0;

  async givenPreference(preference: StoredPreference, userId?: string): Promise<string> {
    this.#sequence += 1;
    const id = userId ?? `preference-user-${this.#sequence}`;
    this.#preferences.set(id, preference);
    return id;
  }

  async givenUserWithoutPreference(): Promise<string> {
    this.#sequence += 1;
    return `preference-user-${this.#sequence}`;
  }

  async listActiveTimezones(): Promise<string[]> {
    const timezones = new Set([...this.#preferences.values()].map(({ timezone }) => timezone));
    return [...timezones].filter((timezone) => normalizeIanaTimezone(timezone) != null);
  }

  async getUserLocales(userIds: readonly UserId[]): Promise<RecipientLocaleOf> {
    return recipientLocaleOf(
      new Map(
        userIds.flatMap(({ value: userId }) => {
          const preference = this.#preferences.get(userId);
          return preference == null ? [] : [[userId, preference.locale] as const];
        }),
      ),
    );
  }
}
