import type { PreferenceResponse } from '@aido/api';
import { ApiError } from '@src/shared/errors/api-error';

const generatePreferenceDto = (): PreferenceResponse => ({
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
});

export const createPreferenceDto = (
  overrides?: Partial<PreferenceResponse>,
): PreferenceResponse => ({
  ...generatePreferenceDto(),
  ...overrides,
});

export const createPreferenceApiError = (
  overrides?: Partial<{ code: string; message: string; status: number }>,
) =>
  new ApiError(
    overrides?.code ?? 'PREFERENCE_1702',
    overrides?.message ?? '알림 시간이 올바르지 않아요',
    overrides?.status ?? 400,
  );

export const INVALID_DTO = { invalid: 'data' };
