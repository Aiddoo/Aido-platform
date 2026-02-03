import { z } from 'zod';

/**
 * 알림 브로드캐스트 결과 응답
 *
 * - successCount: 성공적으로 발송된 알림 수
 * - failCount: 발송 실패한 알림 수
 * - totalTargets: 전체 대상 사용자 수
 */
export const broadcastResultSchema = z
  .object({
    successCount: z.number().int().nonnegative().describe('성공적으로 발송된 알림 수'),
    failCount: z.number().int().nonnegative().describe('발송 실패한 알림 수'),
    totalTargets: z.number().int().nonnegative().describe('전체 대상 사용자 수'),
  })
  .describe('알림 브로드캐스트 결과')
  .meta({
    example: {
      successCount: 148,
      failCount: 2,
      totalTargets: 150,
    },
  });

export type BroadcastResult = z.infer<typeof broadcastResultSchema>;
