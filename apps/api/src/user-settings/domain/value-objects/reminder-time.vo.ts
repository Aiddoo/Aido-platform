import { ErrorCode } from "@aido/errors";

import { DomainException } from "@/shared/domain/exceptions/domain.exception";

/**
 * 리마인더 시간 범위 불변식.
 *
 * 아침 리마인더는 오전(0-11), 저녁 리마인더는 오후(12-23)만 허용한다.
 * 범위를 벗어나면 PREFERENCE_1702.
 */
export const ReminderTime = {
	assertValidRanges(input: { morningReminderHour?: number; eveningReminderHour?: number }): void {
		if (input.morningReminderHour !== undefined && input.morningReminderHour > 11) {
			throw new DomainException(ErrorCode.PREFERENCE_1702);
		}
		if (input.eveningReminderHour !== undefined && input.eveningReminderHour < 12) {
			throw new DomainException(ErrorCode.PREFERENCE_1702);
		}
	},
} as const;
