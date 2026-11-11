import { resolveRecipientLocale } from "#api/modules/notification/push/domain/recipient-locale.domain-service";
import { SchedulerPreferenceReaderPort } from "#api/modules/notification/reminders/application/ports/scheduler-preference-reader.port";
import type { UserLocaleMap } from "#api/modules/notification/reminders/application/read-models/scheduler.read-model";
import { normalizeIanaTimezone } from "#api/shared/domain/time/time-zone-name";

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

  async findActiveTimezones(): Promise<string[]> {
    const timezones = new Set([...this.#preferences.values()].map(({ timezone }) => timezone));
    return [...timezones].filter((timezone) => normalizeIanaTimezone(timezone) != null);
  }

  async findUserLocales(userIds: string[]): Promise<UserLocaleMap> {
    return new Map(
      userIds.flatMap((userId) => {
        const preference = this.#preferences.get(userId);
        return preference == null
          ? []
          : [
              [
                userId,
                resolveRecipientLocale({
                  storedLocale: preference.locale,
                  lastRequestLocale: null,
                }),
              ] as const,
            ];
      }),
    );
  }
}
