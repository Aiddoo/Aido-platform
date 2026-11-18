import { z } from "zod";

import { MEMO_LIMITS } from "../../../vocabulary/memo.constants.js";

export const parseMemoRequestSchema = z.object({
  content: z
    .string()
    .min(1, "메모 내용을 입력해주세요")
    .max(
      MEMO_LIMITS.MAX_CONTENT_LENGTH,
      `메모는 ${MEMO_LIMITS.MAX_CONTENT_LENGTH}자 이내여야 합니다`,
    )
    .meta({ description: `AI로 파싱할 메모 내용 (1-${MEMO_LIMITS.MAX_CONTENT_LENGTH}자)` }),
  categoryId: z
    .int()
    .positive("유효하지 않은 카테고리 ID입니다")
    .meta({ description: "기본 카테고리 ID (생성될 모든 할 일에 적용)" }),
});
