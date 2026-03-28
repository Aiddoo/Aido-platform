/**
 * UserPreference 모델 테스트 데이터 빌더
 *
 * @example
 * ```typescript
 * // 기본 설정
 * const pref = UserPreferenceBuilder.create('user-123').build();
 *
 * // 푸시 비활성화
 * const noPush = UserPreferenceBuilder.create('user-123').withPushDisabled().build();
 *
 * // 야간 푸시 허용
 * const nightPush = UserPreferenceBuilder.create('user-123').withNightPushEnabled().build();
 * ```
 */
import type { UserPreference } from "@/generated/prisma/client";
import type { TimeFormat } from "@/generated/prisma/enums";

export class UserPreferenceBuilder {
	private data: UserPreference;
	private static idCounter = 0;

	private constructor(userId: string) {
		UserPreferenceBuilder.idCounter += 1;
		this.data = {
			id: `pref-${UserPreferenceBuilder.idCounter}`,
			userId,
			pushEnabled: true,
			nightPushEnabled: false,
			timezone: "UTC",
			morningReminderHour: 8,
			morningReminderMinute: 0,
			eveningReminderHour: 18,
			eveningReminderMinute: 0,
			timeFormat: "TWELVE_HOUR",
			weatherMorningEnabled: false,
			weatherMorningHour: 7,
			weatherMorningMinute: 0,
			weatherEveningEnabled: false,
			weatherEveningHour: 18,
			weatherEveningMinute: 0,
			currentStreak: 0,
			longestStreak: 0,
			lastCompletedDate: null,
		};
	}

	static create(userId: string): UserPreferenceBuilder {
		return new UserPreferenceBuilder(userId);
	}

	/** ID 카운터 리셋 (테스트 간 격리용) */
	static resetIdCounter(): void {
		UserPreferenceBuilder.idCounter = 0;
	}

	// === ID 관련 ===

	withId(id: string): UserPreferenceBuilder {
		this.data.id = id;
		return this;
	}

	// === 푸시 설정 ===

	withPushEnabled(enabled = true): UserPreferenceBuilder {
		this.data.pushEnabled = enabled;
		return this;
	}

	withPushDisabled(): UserPreferenceBuilder {
		this.data.pushEnabled = false;
		return this;
	}

	withNightPushEnabled(enabled = true): UserPreferenceBuilder {
		this.data.nightPushEnabled = enabled;
		return this;
	}

	// === 타임존 & 리마인더 ===

	withTimezone(timezone: string): UserPreferenceBuilder {
		this.data.timezone = timezone;
		return this;
	}

	withMorningReminderHour(hour: number): UserPreferenceBuilder {
		this.data.morningReminderHour = hour;
		return this;
	}

	withMorningReminderMinute(minute: number): UserPreferenceBuilder {
		this.data.morningReminderMinute = minute;
		return this;
	}

	withEveningReminderHour(hour: number): UserPreferenceBuilder {
		this.data.eveningReminderHour = hour;
		return this;
	}

	withEveningReminderMinute(minute: number): UserPreferenceBuilder {
		this.data.eveningReminderMinute = minute;
		return this;
	}

	withTimeFormat(format: TimeFormat): UserPreferenceBuilder {
		this.data.timeFormat = format;
		return this;
	}

	// === 빌드 ===

	build(): UserPreference {
		return { ...this.data };
	}

	/** 여러 개 생성 */
	static createMany(userIds: string[]): UserPreference[] {
		return userIds.map((userId) =>
			UserPreferenceBuilder.create(userId).build(),
		);
	}
}
