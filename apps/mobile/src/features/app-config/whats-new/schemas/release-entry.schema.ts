import type { ParseKeys } from 'i18next';
import { z } from 'zod';

import { releaseSchema } from '../domains/whats-new.model';

const releaseEntrySchema = releaseSchema.extend({
  summaryKey: z.custom<ParseKeys<'whatsNew'>>((value) => typeof value === 'string'),
});
export type ReleaseEntry = z.infer<typeof releaseEntrySchema>;

export const releaseEntryListSchema = z.tuple([releaseEntrySchema], releaseEntrySchema);
