import { z } from "zod";

/** 푸시 빈도 제한 저장소. 모든 배포 환경의 기본값은 postgres이고 memory는 테스트용이다. */
const PUSH_RATE_LIMIT_BACKENDS = ["postgres", "redis", "memory"] as const;
export type PushRateLimitBackend = (typeof PUSH_RATE_LIMIT_BACKENDS)[number];

/** Expo Push 서비스 인증 설정. Enhanced Push Security를 사용하지 않으면 선택적이다. */
export const pushSchema = z.object({
  EXPO_ACCESS_TOKEN: z.string().optional(),
  PUSH_RATE_LIMIT_BACKEND: z.enum(PUSH_RATE_LIMIT_BACKENDS).default("postgres"),
});

export type PushConfig = z.infer<typeof pushSchema>;
