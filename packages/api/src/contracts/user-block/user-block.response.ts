import { z } from "zod";

import { datetimeSchema } from "../../common/datetime.js";

export const blockedUserSchema = z
  .object({
    id: z.cuid().describe("차단한 사용자 ID (CUID 25자)"),
    userTag: z.string().length(8).describe("사용자 태그 (8자 영숫자 대문자, 예: JOHN2026)"),
    name: z.string().nullable().describe("사용자 이름 (미설정 시 null)"),
    profileImage: z
      .string()
      .nullable()
      .describe("프로필 이미지 (고양이 아이콘 키 또는 URL, 미설정 시 null)"),
    blockedAt: datetimeSchema.describe("차단한 시각 (ISO 8601 UTC)"),
  })
  .meta({
    example: {
      id: "clz7x5p8k0005qz0z8z8z8z8z",
      userTag: "JOHN2026",
      name: "존",
      profileImage: "orange_tabby",
      blockedAt: "2026-10-26T09:00:00.000Z",
    },
  });

export type BlockedUser = z.infer<typeof blockedUserSchema>;

export const blockedUsersResponseSchema = z
  .object({
    items: z.array(blockedUserSchema).describe("차단한 사용자 목록 (최근에 차단한 순)"),
    totalCount: z
      .number()
      .int()
      .nonnegative()
      .describe("차단한 전체 사용자 수 (탈퇴 중인 사용자 제외)"),
    hasMore: z.boolean().describe("다음 페이지 존재 여부"),
    nextCursor: z.cuid().nullable().describe("다음 페이지 커서 (없으면 null)"),
  })
  .meta({
    example: {
      items: [
        {
          id: "clz7x5p8k0005qz0z8z8z8z8z",
          userTag: "JOHN2026",
          name: "존",
          profileImage: "orange_tabby",
          blockedAt: "2026-10-26T09:00:00.000Z",
        },
      ],
      totalCount: 1,
      hasMore: false,
      nextCursor: null,
    },
  });

export type BlockedUsersResponse = z.infer<typeof blockedUsersResponseSchema>;

export const blockUserResponseSchema = z
  .object({
    message: z.string().describe("결과 메시지"),
    blockedUserId: z.cuid().describe("차단한 사용자 ID (CUID 25자)"),
    blockedAt: datetimeSchema.describe("차단한 시각 (이미 차단한 사용자면 처음 차단한 시각)"),
  })
  .meta({
    example: {
      message: "사용자를 차단했습니다.",
      blockedUserId: "clz7x5p8k0005qz0z8z8z8z8z",
      blockedAt: "2026-10-26T09:00:00.000Z",
    },
  });

export type BlockUserResponse = z.infer<typeof blockUserResponseSchema>;

export const unblockUserResponseSchema = z
  .object({
    message: z.string().describe("결과 메시지"),
  })
  .meta({ example: { message: "차단을 해제했습니다." } });

export type UnblockUserResponse = z.infer<typeof unblockUserResponseSchema>;
