import { z } from "zod";

import { ACTION_PLAN_LIMITS } from "../../../vocabulary/ai.constants.js";
import { PLAN_CATALOG } from "../../../vocabulary/plan-catalog.constants.js";

export const voiceNoteSegmentSchema = z.object({
  startMs: z.number().int().nonnegative().describe("녹음 시작부터 이 문장까지의 시간 (밀리초)"),
  text: z.string().min(1).describe("기기가 전사한 문장"),
  isBookmarked: z.boolean().describe("녹음 중 중요 표시를 했는지"),
});

export type VoiceNoteSegment = z.infer<typeof voiceNoteSegmentSchema>;

/**
 * 글자 상한은 등급마다 달라 요청 schema가 아니라 서버 정책이 막는다(AI_1312).
 * 전체 크기는 라우트별 본문 크기 제한이 막는다.
 */
export const voiceNoteDigestRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "내용을 입력해주세요")
    .describe(
      `기기가 전사한 전체 글자. 등급별 상한(프리미엄 ${PLAN_CATALOG.VOICE_NOTE.perUse.maxCharacters.premium.toLocaleString("ko-KR")}자)을 넘으면 AI_1312`,
    ),
  durationSeconds: z.number().int().nonnegative().describe("녹음 길이 (초)"),
  segments: z
    .array(voiceNoteSegmentSchema)
    .max(ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS)
    .describe(
      `문장 단위 전사 (최대 ${ACTION_PLAN_LIMITS.DIGEST_MAX_SEGMENTS}개). 핵심 포인트의 시각을 이 값에서 찾는다. 없으면 빈 배열`,
    ),
});

export type VoiceNoteDigestRequest = z.infer<typeof voiceNoteDigestRequestSchema>;
