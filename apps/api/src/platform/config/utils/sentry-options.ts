/**
 * Sentry 초기화 옵션 결정 (instrument.ts에서 사용)
 *
 * 배포 환경은 appConfig(APP_ENV 우선, 없으면 NODE_ENV)가 정한다. 이벤트 발송(enabled)은
 * production에서만이고, environment 태그는 항상 설정되므로 Sentry 알림 규칙에서도 다시 거를 수 있다.
 */

import * as Sentry from "@sentry/nestjs";
import { z } from "zod";

import { appConfig } from "../app.config.js";
import type { AppEnvironment } from "../schemas/app.schema.js";

/**
 * 분산 추적 헤더(sentry-trace·baggage)를 붙일 대상 — 우리 서비스로 한정한다.
 *
 * Sentry는 기본적으로 **모든** 아웃바운드 HTTP에 추적 헤더를 주입하는데,
 * data.go.kr(기상청·천문연·에어코리아) 게이트웨이가 `baggage` 헤더를 요청 파라미터로
 * 잘못 파싱해 `INVALID_REQUEST_PARAMETER_ERROR`(코드 10, HTTP 400)로 거부한다.
 * 그 결과 날씨 조회가 전량 실패했다(WEATHER_1901 → 503).
 *
 * 외부 API는 우리 트레이스에 참여할 수 없어 헤더를 보낼 이유도 없다.
 * (아웃바운드 span 자체는 계속 기록되므로 관측성 손실은 없다)
 */
const TRACE_PROPAGATION_TARGETS = [/^https:\/\/api\.aido\.kr/] as const;

/**
 * 5xx 이벤트에 요청 본문을 붙이지 않을 경로. AI 요청 본문은 사용자 할 일 문장·메모 원문이고
 * AI_1301(503)처럼 공급자 장애로 5xx가 날 때 Sentry로 그대로 나가므로 본문 수집을 끈다.
 */
const BODYLESS_PATH = /\/(?:ai|quick-plans|voice-notes|action-plans)(?:[/?]|$)/;

export function isRequestBodyIgnored(url: string): boolean {
  return BODYLESS_PATH.test(url);
}

/**
 * AI 호출 span에는 모델·토큰·지연만 남긴다. 입력(사용자 할 일·메모 문장, 시스템 지시)과 모델 응답은
 * 싣지 않는다. 명시값이 Sentry 전역 기본값(dataCollection.genAI)보다 우선한다.
 */
const AI_SPAN_RECORDING = { recordInputs: false, recordOutputs: false } as const;

export function sentryIntegrations() {
  return [
    Sentry.httpIntegration({ ignoreRequestBody: isRequestBodyIgnored }),
    Sentry.vercelAIIntegration(AI_SPAN_RECORDING),
  ];
}

const packageVersionSchema = z.object({ version: z.string().min(1) });

/** Sentry 릴리스 이름은 `/`를 쓸 수 없어 패키지 이름(@aido/server) 대신 고정 접두사를 쓴다 */
export function toSentryRelease(packageJson: unknown): string | undefined {
  const parsed = packageVersionSchema.safeParse(packageJson);
  return parsed.success ? `aido-server@${parsed.data.version}` : undefined;
}

export interface SentryInstrumentOptions {
  enabled: boolean;
  environment: AppEnvironment;
  tracesSampleRate: number;
  tracePropagationTargets: readonly RegExp[];
}

/** process.env 호환 — 필요한 키(APP_ENV/NODE_ENV/SENTRY_*)만 읽는다 */
type SentryEnvSource = Record<string, string | undefined>;

export function resolveSentryOptions(env: SentryEnvSource): SentryInstrumentOptions {
  const { environment, isProduction } = appConfig.parse(env);

  return {
    enabled: isProduction && Boolean(env.SENTRY_DSN),
    environment,
    tracesSampleRate:
      env.SENTRY_TRACES_SAMPLE_RATE != null
        ? Number(env.SENTRY_TRACES_SAMPLE_RATE)
        : isProduction
          ? 0.2
          : 1.0,
    tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
  };
}
