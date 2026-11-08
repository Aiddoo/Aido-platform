import type { updatePreferenceSchema } from '@aido/api';
import type { z } from 'zod';

export type PreferenceChange = Omit<z.input<typeof updatePreferenceSchema>, 'timezone'>;
