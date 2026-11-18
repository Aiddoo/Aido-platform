import { z } from "zod";

import { entityIdSchema } from "../../../common/entity-id.js";
import { USER_BLOCK_LIMITS } from "../../../vocabulary/user-block.constants.js";

export const getBlockedUsersQuerySchema = z.object({
  cursor: entityIdSchema
    .optional()
    .meta({ description: "페이지네이션 커서. 이전 응답의 nextCursor (선택)" }),
  limit: z
    .string()
    .regex(/^\d+$/, "숫자만 입력 가능합니다")
    .transform(Number)
    .pipe(z.int().min(1).max(USER_BLOCK_LIMITS.MAX_PAGE_SIZE))
    .optional()
    .default(USER_BLOCK_LIMITS.DEFAULT_PAGE_SIZE)
    .meta({
      description: `페이지 크기 (1-${USER_BLOCK_LIMITS.MAX_PAGE_SIZE}, 기본값: ${USER_BLOCK_LIMITS.DEFAULT_PAGE_SIZE})`,
    }),
});
