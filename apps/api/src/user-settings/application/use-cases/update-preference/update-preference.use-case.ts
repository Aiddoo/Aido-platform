import { ErrorCode } from "@aido/errors";
import type {
	UpdatePreferenceInput,
	UpdatePreferenceResponse,
} from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { buildUpdatedPreferenceView } from "../../../domain/services/preference-view";
import { ReminderTime } from "../../../domain/value-objects/reminder-time.vo";

import {
	REMINDER_SCHEDULE_ENQUEUER,
	type ReminderScheduleEnqueuerPort,
} from "../../ports/reminder-schedule.enqueuer.port";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";

/**
 * 사용자 설정 수정 유스케이스.
 *
 * 리마인더 시간 변경은 프리미엄 전용(PREFERENCE_1701)이며, 시간 범위 불변식
 * (PREFERENCE_1702)을 검증한다. 변경 시 캐시 무효화 및 즉시 반영 잡을 등록한다.
 */
@Injectable()
export class UpdatePreferenceUseCase {
	readonly #logger = new Logger(UpdatePreferenceUseCase.name);

	constructor(
		@Inject(USER_PREFERENCE_REPOSITORY)
		private readonly preferenceRepository: UserPreferenceRepositoryPort,
		private readonly entitlementService: EntitlementService,
		private readonly cacheService: CacheService,
		@Inject(REMINDER_SCHEDULE_ENQUEUER)
		private readonly reminderEnqueuer: ReminderScheduleEnqueuerPort,
	) {}

	async execute(
		userId: string,
		input: UpdatePreferenceInput,
	): Promise<UpdatePreferenceResponse> {
		const changesReminder =
			input.morningReminderHour !== undefined ||
			input.morningReminderMinute !== undefined ||
			input.eveningReminderHour !== undefined ||
			input.eveningReminderMinute !== undefined;

		// 리마인더 시간 변경 시 프리미엄 체크
		if (changesReminder) {
			const hasPremium = await this.entitlementService.hasPremiumAccess(userId);
			if (!hasPremium) {
				throw new ApplicationException(ErrorCode.PREFERENCE_1701);
			}
		}

		// 리마인더 시간 범위 검증 (오전: 0-11, 오후: 12-23)
		ReminderTime.assertValidRanges(input);

		const updated = await this.preferenceRepository.upsert(userId, {
			pushEnabled: input.pushEnabled,
			nightPushEnabled: input.nightPushEnabled,
			timezone: input.timezone,
			morningReminderHour: input.morningReminderHour,
			morningReminderMinute: input.morningReminderMinute,
			eveningReminderHour: input.eveningReminderHour,
			eveningReminderMinute: input.eveningReminderMinute,
			timeFormat: input.timeFormat,
			weatherMorningEnabled: input.weatherMorningEnabled,
			weatherMorningHour: input.weatherMorningHour,
			weatherMorningMinute: input.weatherMorningMinute,
			weatherEveningEnabled: input.weatherEveningEnabled,
			weatherEveningHour: input.weatherEveningHour,
			weatherEveningMinute: input.weatherEveningMinute,
		});
		await this.cacheService.invalidateUserPreference(userId);

		// 타임존 또는 pushEnabled 변경 시 활성 타임존 목록 캐시 무효화
		if (input.timezone !== undefined || input.pushEnabled !== undefined) {
			await this.cacheService.invalidateActiveTimezones();
		}

		this.#logger.log(
			`User ${userId} updated preference: pushEnabled=${updated.pushEnabled}, nightPushEnabled=${updated.nightPushEnabled}, timezone=${updated.timezone}`,
		);

		// 리마인더 시간 변경 시 즉시 반영 큐 잡 등록
		// (현재 시간과 동일한 시간으로 변경했을 때 크론이 이미 지나간 경우 보완)
		if (changesReminder) {
			this.reminderEnqueuer.enqueueReminderHourChanged({
				userId,
				timezone: updated.timezone,
				morningReminderHour: input.morningReminderHour,
				morningReminderMinute: input.morningReminderMinute,
				eveningReminderHour: input.eveningReminderHour,
				eveningReminderMinute: input.eveningReminderMinute,
			});
		}

		return buildUpdatedPreferenceView(updated);
	}
}
