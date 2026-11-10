import { semanticVersionPattern } from '@aido/api/vocabulary';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';

import { releaseSchema } from '../domains/whats-new.model';

const whatsNewKeySchema = z.custom<ParseKeys<'whatsNew'>>((value) => typeof value === 'string');

const releaseEntrySchema = releaseSchema.extend({
  /** 패치 노트의 버전. id는 route·지표 값이라 기능이 나온 버전과 다를 수 있다 */
  version: z.string().regex(new RegExp(semanticVersionPattern)),
  titleKey: whatsNewKeySchema,
  descriptionKey: whatsNewKeySchema,
});
export type ReleaseEntry = z.infer<typeof releaseEntrySchema>;

export const releaseEntryListSchema = z.tuple([releaseEntrySchema], releaseEntrySchema);
