import {
  parsedMemoDataSchema,
  parsedMemoTodoSchema,
  parseMemoMetaSchema,
  parseMemoResponseSchema,
} from '@aido/api';
import { AI_PARSE_LIMITS } from '@aido/api/vocabulary';
import type { QuickPlanResult } from '@src/features/voice/schemas/voice-plan.schema';
import { z } from 'zod';

/** 지금 서버는 반복 규칙, 겹치는 할 일, 생략한 개수를 항상 싣는다. 계약의 선택 칸을 앱에서는 필수로 읽는다 */
export const parseMemoPlanResponseSchema = parseMemoResponseSchema.extend({
  data: parsedMemoDataSchema.extend({
    todos: z
      .array(parsedMemoTodoSchema.required({ repeat: true, duplicateOfTodoId: true }))
      .min(1)
      .max(AI_PARSE_LIMITS.MEMO_MAX_TODOS),
  }),
  meta: parseMemoMetaSchema.required({ omittedTodoCount: true }),
});
export type ParseMemoPlanResponse = z.infer<typeof parseMemoPlanResponseSchema>;

/** 메모 정리 결과. 계획과, 이 요청을 반영한 AI 할 일 만들기 한도(서버가 한도를 읽지 못하면 싣지 않아 null) */
export type ParsedMemoPlan = Pick<QuickPlanResult, 'plan' | 'featureQuota'>;
