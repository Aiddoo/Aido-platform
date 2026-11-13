import { z } from "zod";

import { entityIdSchema, entityIdSchemaWithMessage } from "../../../common/entity-id.js";
import { USER_SEARCH_QUERY_LENGTH, USER_TAG_LENGTH } from "../../../vocabulary/follow.constants.js";
import { reorderPositionSchema } from "../../todo-category/v1/todo-category.common.js";

export const userIdParamSchema = z.object({
  userId: entityIdSchemaWithMessage("유효하지 않은 사용자 ID입니다").describe(
    "사용자 ID (예: clz7x5p8k0001qz0z8z8z8z8z)",
  ),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const userTagParamSchema = z.object({
  userTag: z
    .string()
    .length(USER_TAG_LENGTH, "사용자 태그는 8자리입니다")
    .regex(/^[A-Z0-9]+$/, "사용자 태그는 영문 대문자와 숫자만 허용됩니다")
    .describe("사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)"),
});

export type UserTagParam = z.infer<typeof userTagParamSchema>;

export const getFollowsQuerySchema = z.object({
  cursor: entityIdSchema.optional().describe("페이지네이션 커서 (선택)"),
  limit: z
    .string()
    .regex(/^\d+$/, "숫자만 입력 가능합니다")
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .optional()
    .default(20)
    .describe("페이지 크기 (1-50, 기본값: 20)"),
});

export type GetFollowsQuery = z.infer<typeof getFollowsQuerySchema>;

export const getFriendsQuerySchema = z.object({
  cursor: entityIdSchema.optional().describe("페이지네이션 커서 (선택)"),
  limit: z
    .string()
    .regex(/^\d+$/, "숫자만 입력 가능합니다")
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .optional()
    .default(20)
    .describe("페이지 크기 (1-50, 기본값: 20)"),
  search: z
    .string()
    .max(50, "검색어는 50자 이내여야 합니다")
    .optional()
    .describe("검색어 (최대 50자, 선택)"),
});

export type GetFriendsQuery = z.infer<typeof getFriendsQuerySchema>;

export const searchUsersQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(
      USER_SEARCH_QUERY_LENGTH.MIN,
      `검색어는 ${USER_SEARCH_QUERY_LENGTH.MIN}자 이상이어야 합니다`,
    )
    .max(USER_SEARCH_QUERY_LENGTH.MAX, `검색어는 ${USER_SEARCH_QUERY_LENGTH.MAX}자 이내여야 합니다`)
    .describe(
      `검색어: 이름 또는 Aido ID (${USER_SEARCH_QUERY_LENGTH.MIN}-${USER_SEARCH_QUERY_LENGTH.MAX}자)`,
    ),
  // 관련도 랭킹 keyset을 인코딩한 불투명 커서. 다른 팔로우 쿼리와 달리 엔티티 ID가 아니다.
  cursor: z.string().optional().describe("페이지네이션 커서 (불투명 문자열, 선택)"),
  limit: z
    .string()
    .regex(/^\d+$/, "숫자만 입력 가능합니다")
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .optional()
    .default(20)
    .describe("페이지 크기 (1-50, 기본값: 20)"),
});

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;

export const reorderFriendSchema = z.object({
  targetFollowId: entityIdSchemaWithMessage("유효하지 않은 Follow ID입니다")
    .optional()
    .describe("기준 팔로우 ID (선택, 생략 시 맨 앞/뒤로 이동)"),
  position: reorderPositionSchema.describe("이동 위치 (before: 기준 앞으로, after: 기준 뒤로)"),
});

export type ReorderFriendInput = z.infer<typeof reorderFriendSchema>;
