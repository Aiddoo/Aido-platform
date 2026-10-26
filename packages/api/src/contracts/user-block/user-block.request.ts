import { z } from "zod";

import { USER_BLOCK_LIMITS } from "../../vocabulary/user-block.constants.js";
import { userIdParamSchema } from "../follow/follow.request.js";

export const blockUserParamSchema = userIdParamSchema;

export type BlockUserParam = z.infer<typeof blockUserParamSchema>;

export const unblockUserParamSchema = userIdParamSchema;

export type UnblockUserParam = z.infer<typeof unblockUserParamSchema>;

export const getBlockedUsersQuerySchema = z.object({
  cursor: z
    .cuid()
    .optional()
    .describe("페이지네이션 커서. 이전 응답의 nextCursor (CUID 25자, 선택)"),
  limit: z
    .string()
    .regex(/^\d+$/, "숫자만 입력 가능합니다")
    .transform(Number)
    .pipe(z.number().int().min(1).max(USER_BLOCK_LIMITS.MAX_PAGE_SIZE))
    .optional()
    .default(USER_BLOCK_LIMITS.DEFAULT_PAGE_SIZE)
    .describe(
      `페이지 크기 (1-${USER_BLOCK_LIMITS.MAX_PAGE_SIZE}, 기본값: ${USER_BLOCK_LIMITS.DEFAULT_PAGE_SIZE})`,
    ),
});

export type GetBlockedUsersQuery = z.infer<typeof getBlockedUsersQuerySchema>;
