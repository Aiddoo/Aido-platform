import { preferenceResponseSchema } from '@aido/api/contracts/user-preference/v1';
import type { ErrorCodeType } from '@aido/api/errors';
import { createApiError } from '@src/testing/api-error';
import { defineFixture } from '@src/testing/fixture';

import { preferenceSchema } from '../domains/preference.model';

const PREFERENCE = {
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
  aiPushEnabled: true,
} as const;

export const createPreferenceDto = defineFixture(preferenceResponseSchema, PREFERENCE);

export const createPreference = defineFixture(preferenceSchema, PREFERENCE);

export function createPreferenceApiError(
  overrides?: Partial<{ code: ErrorCodeType; message: string; status: number }>,
) {
  return createApiError(overrides?.code ?? 'PREFERENCE_1702', {
    message: overrides?.message ?? '알림 시간이 올바르지 않아요',
    status: overrides?.status ?? 400,
  });
}
