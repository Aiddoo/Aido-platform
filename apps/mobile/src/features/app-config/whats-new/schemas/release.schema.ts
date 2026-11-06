import type { ParseKeys } from 'i18next';
import { z } from 'zod';

export const RELEASE_ID = {
  v1_15_0: '1.15.0',
  v1_14_0: '1.14.0',
} as const;

export const releaseIdSchema = z.enum(RELEASE_ID);
export type ReleaseId = z.infer<typeof releaseIdSchema>;

const releaseSchema = z.object({
  id: releaseIdSchema,
  /** 서버 설정의 campaignId, 기기의 본 기록 키와 같은 값이다 */
  campaignId: z.string().min(1),
  /** 화면에 보이지 않고 최신 출시를 고를 때만 쓴다 */
  releasedOn: z.iso.date(),
  summaryKey: z.custom<ParseKeys<'whatsNew'>>((value) => typeof value === 'string'),
  /** 소개하는 기능이 초대 운영 플래그로 꺼질 수 있으면 true */
  requiresInvite: z.boolean(),
});
export type Release = z.infer<typeof releaseSchema>;

export const releaseListSchema = z.tuple([releaseSchema], releaseSchema);
export type ReleaseList = z.infer<typeof releaseListSchema>;
