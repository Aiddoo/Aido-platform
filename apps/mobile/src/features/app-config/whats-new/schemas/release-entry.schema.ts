import { semanticVersionPattern } from '@aido/api/vocabulary';
import { FEATURE_KEYS } from '@src/shared/analytics/feature-key';
import type { Href } from 'expo-router';
import type { ParseKeys } from 'i18next';
import { z } from 'zod';

import { releaseSchema } from '../domains/whats-new.model';

const whatsNewKeySchema = z.custom<ParseKeys<'whatsNew'>>((value) => typeof value === 'string');
const hrefSchema = z.custom<Href>(
  (value) => typeof value === 'string' || (typeof value === 'object' && value != null),
);

/** 바로 해 보기. 그 기능을 바로 쓸 수 있는 화면이다 */
const releaseCtaSchema = z.object({
  href: hrefSchema,
  feature: z.enum(FEATURE_KEYS),
});

/** 목록 한 줄. 기능 출시마다 하나씩 쌓는다. 여러 단계 소개는 따로 두고 최근 두 출시만 남긴다 */
const releaseEntrySchema = releaseSchema.extend({
  /** 패치 노트의 버전. id는 route·지표 값이라 기능이 나온 버전과 다를 수 있다 */
  version: z.string().regex(new RegExp(semanticVersionPattern)),
  titleKey: whatsNewKeySchema,
  descriptionKey: whatsNewKeySchema,
  cta: releaseCtaSchema.optional(),
});
export type ReleaseEntry = z.infer<typeof releaseEntrySchema>;

export const releaseEntryListSchema = z.tuple([releaseEntrySchema], releaseEntrySchema);
