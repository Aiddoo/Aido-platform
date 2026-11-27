import { z } from "zod";

import { datetimeSchema, nullableDatetimeSchema } from "../../../common/datetime.js";
import { entityIdSchema } from "../../../common/entity-id.js";
import { ACCOUNT_PROVIDERS, USER_ROLE, USER_STATUS } from "../../../vocabulary/auth.constants.js";
import { USER_TAG_LENGTH } from "../../../vocabulary/follow.constants.js";
import type { PremiumFeature } from "../../../vocabulary/plan-catalog.constants.js";
import {
  PREMIUM_SOURCE,
  SUBSCRIPTION_PLAN_TYPES,
  SUBSCRIPTION_STATUS,
} from "../../../vocabulary/subscription.constants.js";
import { deviceTypeSchema, oauthProviderSchema } from "./auth.request.js";

export const userStatusSchema = z.enum(USER_STATUS).meta({ description: "사용자 계정 상태" });
export const userRoleSchema = z
  .enum([USER_ROLE.USER, USER_ROLE.ADMIN])
  .meta({ description: "사용자 역할 (USER: 일반 사용자, ADMIN: 관리자)" });
export const accountProviderSchema = z
  .enum(ACCOUNT_PROVIDERS)
  .meta({ description: "계정 제공자 (이메일/소셜)" });

export const authTokensSchema = z
  .object({
    userId: entityIdSchema.meta({ description: "사용자 고유 ID (예: clz7x5p8k0001qz0z8z8z8z8z)" }),
    accessToken: z.string().meta({ description: "JWT 액세스 토큰 (유효기간: 15분)" }),
    refreshToken: z.string().meta({ description: "JWT 리프레시 토큰 (유효기간: 7일)" }),
    name: z.string().nullable().meta({ description: "사용자 이름 (미설정 시 null)" }),
    profileImage: z.string().nullable().meta({ description: "프로필 이미지 URL (미설정 시 null)" }),
    accountRestored: z
      .boolean()
      .optional()
      .meta({ description: "탈퇴 유예 기간 내 계정 복구 여부" }),
    isNewUser: z.boolean().optional().meta({
      description:
        "이번 요청에서 계정을 새로 만들었는지 여부. 소셜 로그인·OAuth 코드 교환 응답에만 있고, 기존 계정·이메일 자동 연결·탈퇴 유예 복구는 false",
    }),
  })
  .meta({
    description: "인증 토큰 정보",
    example: {
      userId: "clz7x5p8k0001qz0z8z8z8z8z",
      accessToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwiZW1haWwiOiJkeWRhbHMzNDQwQGdtYWlsLmNvbSIsImlhdCI6MTcwNTQ4MzIwMH0.example",
      refreshToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDU0ODMyMDB9.example",
      name: "매튜",
      profileImage: "https://example.com/profiles/matthew.jpg",
    },
  });

export const refreshTokensSchema = z
  .object({
    accessToken: z.string().meta({ description: "JWT 액세스 토큰 (갱신됨, 유효기간: 15분)" }),
    refreshToken: z.string().meta({ description: "JWT 리프레시 토큰 (갱신됨, 유효기간: 7일)" }),
  })
  .meta({
    description: "토큰 갱신 응답",
    example: {
      accessToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwiZW1haWwiOiJkeWRhbHMzNDQwQGdtYWlsLmNvbSIsImlhdCI6MTcwNTQ4MzIwMH0.newtoken",
      refreshToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHo3eDVwOGswMDAxcXowejh6OHo4ejh6IiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDU0ODMyMDB9.newtoken",
    },
  });

// JWT 페이로드에서 추출된 사용자 정보 (req.user)
export const currentUserPayloadSchema = z
  .object({
    userId: entityIdSchema.meta({ description: "사용자 고유 ID (예: clz7x5p8k0001qz0z8z8z8z8z)" }),
    email: z.email().meta({ description: "이메일 주소" }),
    sessionId: entityIdSchema.meta({ description: "현재 세션 ID (예: clz7x5p8k0002qz0z8z8z8z8z)" }),
    role: userRoleSchema.meta({ description: "사용자 역할" }),
  })
  .meta({
    description: "JWT 페이로드 사용자 정보",
    example: {
      userId: "clz7x5p8k0001qz0z8z8z8z8z",
      email: "dydals3440@gmail.com",
      sessionId: "clz7x5p8k0002qz0z8z8z8z8z",
      role: "USER",
    },
  });

export type CurrentUserPayload = z.infer<typeof currentUserPayloadSchema>;

export const subscriptionStatusSchema = z
  .enum(SUBSCRIPTION_STATUS)
  .meta({ description: "구독 상태 (FREE: 무료, ACTIVE: 구독 중, EXPIRED: 만료, CANCELLED: 취소)" });

export const premiumSourceSchema = z
  .enum(PREMIUM_SOURCE)
  .meta({ description: "프리미엄 출처 (STORE: 스토어 구독, GRANT: 서버가 지급한 보상 기간)" });

export const subscriptionPlanTypeSchema = z
  .enum(SUBSCRIPTION_PLAN_TYPES)
  .meta({ description: "요금제 종류 (ANNUAL: 연간 구독, MONTHLY: 월간 구독)" });

export const premiumFeatureEntitlementSchema = z
  .object({
    allowed: z.boolean().meta({
      description:
        "이 기능을 쓸 수 있는지입니다. 횟수·개수 기능은 한도가 0보다 크거나 무제한이면 true입니다(남은 횟수가 0이어도 true).",
    }),
    limit: z.int().nonnegative().nullable().meta({
      description:
        "횟수(quota)·개수(resource) 한도입니다. null은 무제한이고, 켜고 끄는 기능(flag)은 항상 null입니다. 친구 보너스 자리를 포함합니다.",
    }),
    used: z.int().nonnegative().optional().meta({
      description:
        "지금 초기화 창에서 쓴 횟수입니다. 횟수 기능(AI_PARSE·CHEER·NUDGE)만 있습니다. 프리미엄이 끝나도 창 안의 사용량은 그대로 세고 한도만 바뀝니다.",
    }),
    resetsAt: datetimeSchema.optional().meta({
      description:
        "used가 0으로 돌아가는 다음 시각입니다 (ISO 8601 UTC). AI_PARSE는 KST 매월 1일 00:00, CHEER·NUDGE는 요청 X-Timezone 기준 다음 자정입니다.",
    }),
  })
  .meta({ description: "유료 기능 하나의 현재 권한" });

const premiumEntitlementShape = {
  AI_PARSE: premiumFeatureEntitlementSchema,
  CHEER: premiumFeatureEntitlementSchema,
  NUDGE: premiumFeatureEntitlementSchema,
  FRIEND: premiumFeatureEntitlementSchema,
  TODO_CATEGORY: premiumFeatureEntitlementSchema,
  AI_REPORT: premiumFeatureEntitlementSchema,
  AI_SUGGESTION: premiumFeatureEntitlementSchema,
  CUSTOM_REMINDER_TIME: premiumFeatureEntitlementSchema,
  APP_ICON: premiumFeatureEntitlementSchema,
} satisfies Record<PremiumFeature, typeof premiumFeatureEntitlementSchema>;

/** 새 서버가 기능을 더해도 이전 앱이 응답을 거절하지 않도록 모르는 키를 허용한다. */
export const premiumEntitlementsSchema = z.looseObject(premiumEntitlementShape).meta({
  description:
    "PREMIUM_FEATURES 카탈로그의 기능별 현재 권한입니다. ADMIN은 프리미엄 요금제와 같은 값을 받습니다. 만료·자동 갱신 유예(3시간)를 반영한 서버 판단과 같습니다.",
});

export const currentUserSchema = z
  .object({
    userId: entityIdSchema.meta({ description: "사용자 고유 ID" }),
    email: z.email().meta({ description: "이메일 주소" }),
    sessionId: entityIdSchema.meta({ description: "현재 세션 ID" }),
    userTag: z
      .string()
      .length(USER_TAG_LENGTH)
      .meta({ description: "사용자 태그 (8자리 영숫자, 해시태그 검색용)" }),
    role: userRoleSchema.meta({ description: "사용자 역할" }),
    status: userStatusSchema.meta({ description: "계정 상태" }),
    emailVerifiedAt: nullableDatetimeSchema.meta({
      description: "이메일 인증 완료 시점 (미인증 시 null)",
    }),
    subscriptionStatus: subscriptionStatusSchema.meta({ description: "구독 상태" }),
    subscriptionExpiresAt: nullableDatetimeSchema.meta({
      description: "구독 만료 시점 (무료 사용자는 null)",
    }),
    name: z.string().nullable().meta({ description: "사용자 이름" }),
    profileImage: z.string().nullable().meta({ description: "프로필 이미지 (아이콘 키 또는 URL)" }),
    createdAt: datetimeSchema.meta({ description: "가입 일시" }),
    providers: z
      .array(accountProviderSchema)
      .meta({ description: '연결된 로그인 제공자 목록 (예: ["CREDENTIAL", "KAKAO"])' }),
    premiumSource: premiumSourceSchema.nullable().optional().meta({
      description:
        "프리미엄 출처입니다. STORE는 스토어 구독(RevenueCat 프로모션 포함), GRANT는 초대 등 서버가 준 보상 기간, 둘 다 없으면 null입니다. ADMIN은 role로 프리미엄과 같은 기능·한도를 받고 이 필드는 스토어·보상 기간만 반영합니다. 구버전 서버는 생략합니다.",
    }),
    premiumEndsAt: nullableDatetimeSchema.optional().meta({
      description:
        "프리미엄 전체가 끝나는 시각입니다 (ISO 8601 UTC). 쌓아 둔 보상 일수까지 이어 붙인 끝입니다. STORE에 쌓아 둔 보상이 없으면 스토어 만료 시각, 있으면 스토어가 끝나는 시각(취소했으면 만료 시각, 자동 갱신 중이면 만료 뒤 유예 3시간)부터 쌓아 둔 일수를 더한 시각입니다. GRANT면 진행 중인 보상 기간 끝에 쌓아 둔 일수를 더한 시각입니다. 지금 기간만의 끝은 premiumPeriodEndsAt을 씁니다. 프리미엄이 아니면 null이고 구버전 서버는 생략합니다.",
    }),
    premiumPeriodEndsAt: nullableDatetimeSchema.optional().meta({
      description:
        "지금 출처의 기간만 끝나는 시각입니다 (ISO 8601 UTC). 쌓아 둔 보상은 넣지 않습니다. STORE면 스토어 구독 만료 시각(자동 갱신이면 다음 결제 예정 시각), GRANT면 진행 중인 보상 기간의 끝입니다. 프리미엄이 아니면 null이고 구버전 서버는 생략합니다.",
    }),
    willRenew: z.boolean().optional().meta({
      description:
        "스토어 구독이 자동 갱신되는지 여부입니다. 취소했지만 만료 전인 구독과 보상 기간만 있으면 false이고 구버전 서버는 생략합니다.",
    }),
    bankedPremiumDays: z.int().nonnegative().optional().meta({
      description:
        "아직 시작하지 않고 쌓아 둔 보상 일수 합계입니다. 지금 기간(스토어 구독이나 진행 중인 보상 기간)이 끝나면 받은 순서대로 이어서 시작합니다. 없으면 0이고 구버전 서버는 생략합니다.",
    }),
    premiumGrantEndedAt: nullableDatetimeSchema.optional().meta({
      description:
        "마지막 보상 기간이 끝난 시각입니다 (ISO 8601 UTC). 지금 프리미엄이 아니고 최근 7일 안에 끝났을 때만 값이 있고, 그 밖에는 null입니다. 구버전 서버는 생략합니다.",
    }),
    premiumIsTrial: z.boolean().optional().meta({
      description:
        "지금 프리미엄이 스토어 무료 체험 기간인지입니다. premiumSource가 STORE이고 스토어가 알려 준 기간 유형이 TRIAL이면 true입니다. 체험이 끝나는 시각은 premiumPeriodEndsAt(스토어 expiration_at_ms)이고 서버가 체험 길이를 계산하지 않습니다. 결제로 넘어가면 false입니다. 1.15.0+ 서버이며 구버전 서버는 생략합니다.",
    }),
    premiumPlanType: subscriptionPlanTypeSchema.nullable().optional().meta({
      description:
        "지금 프리미엄 기간을 정하는 스토어 구독의 요금제입니다. 스토어 상품 ID로 정하고(Play의 \"상품:기본요금제\"는 ':' 앞만 봅니다) 무료 체험이면 체험 뒤 이어질 요금제입니다. premiumSource가 STORE가 아니거나 모르는 상품이면 null입니다. 1.15.0+ 서버이며 구버전 서버는 생략합니다.",
    }),
    isPremium: z.boolean().optional().meta({
      description:
        "지금 유효한 스토어 구독이나 보상 기간이 있는지입니다. 만료 시각과 자동 갱신 유예(3시간)를 반영하므로 subscriptionStatus가 ACTIVE여도 false일 수 있습니다. ADMIN role은 반영하지 않으며 ADMIN이 받는 프리미엄 한도는 entitlements가 나타냅니다. 구버전 서버는 생략합니다.",
    }),
    entitlements: premiumEntitlementsSchema.optional().meta({
      description:
        "기능별 현재 권한입니다. 앱은 기능 한도를 하드코딩하지 않고 이 값으로 막습니다. 구버전 서버는 생략합니다.",
    }),
  })
  .meta({
    description: "현재 사용자 정보",
    example: {
      userId: "clz7x5p8k0001qz0z8z8z8z8z",
      email: "dydals3440@gmail.com",
      sessionId: "clz7x5p8k0002qz0z8z8z8z8z",
      userTag: "MATT2025",
      role: "USER",
      status: "ACTIVE",
      emailVerifiedAt: "2026-01-15T10:30:00.000Z",
      subscriptionStatus: "FREE",
      subscriptionExpiresAt: null,
      name: "매튜",
      profileImage: "https://example.com/profiles/matthew.jpg",
      createdAt: "2026-01-01T09:00:00.000Z",
      providers: ["CREDENTIAL"],
      premiumSource: null,
      premiumEndsAt: null,
      premiumPeriodEndsAt: null,
      willRenew: false,
      bankedPremiumDays: 0,
      premiumGrantEndedAt: null,
      premiumIsTrial: false,
      premiumPlanType: null,
      isPremium: false,
    },
  });

export const sessionInfoSchema = z
  .object({
    id: entityIdSchema.meta({ description: "세션 고유 ID" }),
    deviceName: z.string().nullable().meta({ description: "기기 이름" }),
    deviceType: deviceTypeSchema.nullable().meta({ description: "기기 타입" }),
    ipAddress: z.string().nullable().meta({ description: "접속 IP 주소" }),
    userAgent: z.string().nullable().meta({ description: "User-Agent 문자열" }),
    lastActiveAt: datetimeSchema.meta({ description: "마지막 활동 시각" }),
    createdAt: datetimeSchema.meta({ description: "세션 생성 시각" }),
    isCurrent: z.boolean().meta({ description: "현재 세션 여부" }),
  })
  .meta({
    description: "세션 정보",
    example: {
      id: "clz7x5p8k0002qz0z8z8z8z8z",
      deviceName: "iPhone 15 Pro",
      deviceType: "MOBILE",
      ipAddress: "192.168.1.100",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      lastActiveAt: "2026-01-17T14:25:00.000Z",
      createdAt: "2026-01-15T10:30:00.000Z",
      isCurrent: true,
    },
  });

export const sessionListResponseSchema = z
  .object({
    sessions: z.array(sessionInfoSchema),
  })
  .meta({
    description: "활성 세션 목록 응답",
    example: {
      sessions: [
        {
          id: "clz7x5p8k0002qz0z8z8z8z8z",
          deviceName: "iPhone 15 Pro",
          deviceType: "MOBILE",
          ipAddress: "192.168.1.100",
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
          lastActiveAt: "2026-01-17T14:25:00.000Z",
          createdAt: "2026-01-15T10:30:00.000Z",
          isCurrent: true,
        },
        {
          id: "clz7x5p8k0003qz0z8z8z8z8z",
          deviceName: "MacBook Pro",
          deviceType: "DESKTOP",
          ipAddress: "192.168.1.101",
          userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
          lastActiveAt: "2026-01-16T20:00:00.000Z",
          createdAt: "2026-01-10T09:00:00.000Z",
          isCurrent: false,
        },
      ],
    },
  });

export const registerResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
    email: z.email().meta({ description: "가입한 이메일 주소" }),
    emailSent: z.boolean().optional().meta({
      description:
        "인증 메일을 발송 큐에 담았는지. false면 가입은 됐고 재발송으로 다시 보내면 된다",
    }),
  })
  .meta({
    description: "회원가입 응답",
    example: {
      message: "인증 코드가 이메일로 발송되었습니다.",
      email: "dydals3440@gmail.com",
      emailSent: true,
    },
  });

export const forgotPasswordResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
  })
  .meta({
    description: "비밀번호 찾기 응답",
    example: {
      message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
    },
  });

export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>;

export const resetPasswordResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
  })
  .meta({
    description: "비밀번호 재설정 완료 응답",
    example: {
      message: "비밀번호가 성공적으로 변경되었습니다.",
    },
  });

export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;

export const changePasswordResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
  })
  .meta({
    description: "비밀번호 변경 완료 응답",
    example: {
      message: "비밀번호가 성공적으로 변경되었습니다.",
    },
  });

export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;

export const logoutResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
  })
  .meta({
    description: "로그아웃 응답",
    example: {
      message: "로그아웃되었습니다.",
    },
  });

export const resendVerificationResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
    email: z.email().meta({ description: "인증 코드를 발송한 이메일 주소" }),
    retryAfterSeconds: z
      .int()
      .nonnegative()
      .optional()
      .meta({ description: "재발송 가능까지 남은 시간 (초)" }),
  })
  .meta({
    description: "인증 코드 재발송 응답",
    example: {
      message: "인증 코드가 재발송되었습니다.",
      email: "dydals3440@gmail.com",
      retryAfterSeconds: 60,
    },
  });

export type ResendVerificationResponse = z.infer<typeof resendVerificationResponseSchema>;

export const updateProfileResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
    name: z.string().nullable().meta({ description: "수정된 이름" }),
    profileImage: z
      .string()
      .nullable()
      .meta({ description: "수정된 프로필 이미지 (아이콘 키 또는 URL)" }),
  })
  .meta({
    description: "프로필 수정 응답",
    example: {
      message: "프로필이 수정되었습니다.",
      name: "매튜",
      profileImage: "https://example.com/profiles/matthew.jpg",
    },
  });

export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>;

export const linkedAccountSchema = z
  .object({
    provider: oauthProviderSchema,
    linked: z.boolean().meta({ description: "해당 제공자의 계정 연결 여부" }),
    providerAccountId: z
      .string()
      .nullable()
      .meta({ description: "제공자 측 계정 고유 ID (미연결 시 null)" }),
    linkedAt: nullableDatetimeSchema.meta({
      description: "계정 연결 시각 (ISO 8601 UTC, 미연결 시 null)",
    }),
  })
  .meta({
    description: "소셜 계정 연결 상태",
    example: {
      provider: "GOOGLE",
      linked: true,
      providerAccountId: "102938475647382910",
      linkedAt: "2026-01-15T10:30:00.000Z",
    },
  });

export type LinkedAccount = z.infer<typeof linkedAccountSchema>;

export const linkedAccountsResponseSchema = z
  .object({
    accounts: z
      .array(linkedAccountSchema)
      .meta({ description: "소셜 계정 연결 상태 목록 (항상 4개 제공자 포함)" }),
    canUnlink: z.boolean().meta({ description: "소셜 계정 연결 해제 가능 여부" }),
  })
  .meta({
    description: "소셜 계정 연결 상태 목록 응답",
    example: {
      accounts: [
        {
          provider: "APPLE",
          linked: false,
          providerAccountId: null,
          linkedAt: null,
        },
        {
          provider: "GOOGLE",
          linked: true,
          providerAccountId: "102938475647382910",
          linkedAt: "2026-01-15T10:30:00.000Z",
        },
        {
          provider: "KAKAO",
          linked: true,
          providerAccountId: "3456789012",
          linkedAt: "2026-02-01T14:00:00.000Z",
        },
        {
          provider: "NAVER",
          linked: false,
          providerAccountId: null,
          linkedAt: null,
        },
      ],
      canUnlink: true,
    },
  });

export type LinkedAccountsResponse = z.infer<typeof linkedAccountsResponseSchema>;

export const linkAccountResponseSchema = z.object({ message: z.string() });

export const unlinkAccountResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
    provider: oauthProviderSchema.meta({ description: "연결 해제된 제공자" }),
  })
  .meta({
    description: "소셜 계정 연결 해제 응답",
    example: {
      message: "소셜 계정 연결이 해제되었습니다.",
      provider: "GOOGLE",
    },
  });

export const deleteAccountResponseSchema = z
  .object({
    message: z.string().meta({ description: "응답 메시지" }),
    deletedAt: datetimeSchema.meta({ description: "탈퇴 처리 시각" }),
    gracePeriodDays: z.int().meta({ description: "복구 가능 기간 (일)" }),
  })
  .meta({
    description: "회원 탈퇴 응답",
    example: {
      message: "계정이 탈퇴 처리되었습니다. 30일 이내에 복구할 수 있습니다.",
      deletedAt: "2026-02-13T10:00:00.000Z",
      gracePeriodDays: 30,
    },
  });

export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;
