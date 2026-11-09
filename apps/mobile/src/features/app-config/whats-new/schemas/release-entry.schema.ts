import type { ParseKeys } from 'i18next';
import { z } from 'zod';

import { releaseSchema } from '../domains/whats-new.model';

const whatsNewKeySchema = z.custom<ParseKeys<'whatsNew'>>((value) => typeof value === 'string');

const releaseEntrySchema = releaseSchema.extend({
  titleKey: whatsNewKeySchema,
  descriptionKey: whatsNewKeySchema,
});
export type ReleaseEntry = z.infer<typeof releaseEntrySchema>;

export const releaseEntryListSchema = z.tuple([releaseEntrySchema], releaseEntrySchema);
