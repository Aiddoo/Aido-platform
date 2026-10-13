import type { PreferenceResponse } from '@aido/api';

import type { Preference } from '../domains/preference.model';

export const toPreference = ({
  timezone: _timezone,
  ...preference
}: PreferenceResponse): Preference => preference;
