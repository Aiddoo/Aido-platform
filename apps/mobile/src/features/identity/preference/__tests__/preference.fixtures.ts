import type { PreferenceResponse } from '@aido/api';
import type { ErrorCodeType } from '@aido/api/errors';
import { ApiError } from '@src/core/errors/api-error';

import { type Preference, preferenceSchema } from '../domains/preference.model';

function generatePreferenceDto(): PreferenceResponse {
  return {
    pushEnabled: true,
    nightPushEnabled: false,
    timezone: 'Asia/Seoul',
    morningReminderHour: 8,
    morningReminderMinute: 0,
    eveningReminderHour: 21,
    eveningReminderMinute: 0,
    timeFormat: 'TWELVE_HOUR',
    weatherMorningEnabled: false,
    weatherMorningHour: 7,
    weatherMorningMinute: 0,
    weatherEveningEnabled: false,
    weatherEveningHour: 18,
    weatherEveningMinute: 0,
  };
}

export function createPreferenceDto(overrides?: Partial<PreferenceResponse>): PreferenceResponse {
  return {
    ...generatePreferenceDto(),
    ...overrides,
  };
}

export function createPreference(overrides?: Partial<Preference>): Preference {
  return {
    ...preferenceSchema.parse(generatePreferenceDto()),
    ...overrides,
  };
}

export function createPreferenceApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return new ApiError(
    overrides?.code ?? 'PREFERENCE_1702',
    overrides?.message ?? '알림 시간이 올바르지 않아요',
    overrides?.status ?? 400,
  );
}
