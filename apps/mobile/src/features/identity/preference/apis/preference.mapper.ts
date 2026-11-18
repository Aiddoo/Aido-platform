import type { PreferenceResponse } from '@aido/api/contracts/user-preference/v1';
import { pick } from 'es-toolkit';

import type { Preference } from '../domains/preference.model';

export function toPreference(dto: PreferenceResponse): Preference {
  return pick(dto, [
    'pushEnabled',
    'nightPushEnabled',
    'morningReminderHour',
    'morningReminderMinute',
    'eveningReminderHour',
    'eveningReminderMinute',
    'timeFormat',
    'weatherMorningEnabled',
    'weatherMorningHour',
    'weatherMorningMinute',
    'weatherEveningEnabled',
    'weatherEveningHour',
    'weatherEveningMinute',
    'aiPushEnabled',
  ]);
}
