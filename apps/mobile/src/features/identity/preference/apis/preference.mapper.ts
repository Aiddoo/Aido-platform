import type { PreferenceResponse } from '@aido/api';
import { omit } from 'es-toolkit';

import type { Preference } from '../schemas/preference.schema';

export function toPreference(dto: PreferenceResponse): Preference {
  return omit(dto, ['timezone']);
}
