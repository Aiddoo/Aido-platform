/**
 * Sentry 초기화 옵션 결정 (instrument.ts에서 사용)
 *
 * 배포 환경은 appConfig(APP_ENV 우선, 없으면 NODE_ENV)가 정한다. 이벤트 발송(enabled)은
 * production에서만이고, environment 태그는 항상 설정되므로 Sentry 알림 규칙에서도 다시 거를 수 있다.
 */

import * as Sentry from "@sentry/nestjs";
import { z } from "zod";

import { isBusinessRejection } from "#api/shared/application/utils/business-rejection";

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
 * SDK 11의 기본값은 요청·응답 본문, DB 바인딩 값, 스택 지역 변수, 쿠키·헤더를 모두 모은다.
 * 할 일 제목·메모·전사·AI 입출력이 본문과 바인딩 값으로 나가므로 전부 끄고, 사용자는 ID만 직접 싣는다.
 */
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { allow: ["user-agent", "x-app-version", "x-device-type"] },
    response: false,
  },
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
} satisfies Sentry.NodeOptions["dataCollection"];

/**
 * AI 호출 span에는 모델·토큰·지연만 남긴다. 입력(사용자 할 일·메모 문장, 시스템 지시)과 모델 응답은
 * 싣지 않는다. 명시값이 Sentry 전역 기본값(dataCollection.genAI)보다 우선한다.
 */
const AI_SPAN_RECORDING = { recordInputs: false, recordOutputs: false } as const;

export function sentryIntegrations() {
  return [Sentry.vercelAIIntegration(AI_SPAN_RECORDING)];
}

/** pg-boss 처리 span(`queue.process`)이 큐 이름을 싣는 속성. 표본 결정이 큐별 비율을 고른다 */
export const JOB_QUEUE_SPAN_ATTRIBUTE = "messaging.destination.name";

interface HttpTraceRule {
  readonly method?: string;
  readonly path: RegExp;
  readonly rate: number;
}

/** 경로별 표본 비율. 위에서부터 처음 맞는 규칙을 쓰고, 맞는 규칙이 없으면 기본 비율이다. */
const HTTP_TRACE_RULES: readonly HttpTraceRule[] = [
  // 컨테이너 상태 확인이 주기적으로 부른다
  { path: /^\/(?:health(?:\/.*)?)?$/, rate: 0 },
  // 앱이 화면에 돌아올 때마다 부르는 가벼운 조회라 요청 수에 비해 볼 것이 없다
  {
    method: "GET",
    path: /^\/v\d+\/(?:notifications(?:\/inbox)?\/unread-count|app-config\/[^/]+)$/,
    rate: 0,
  },
  // 결제 반영 흐름. 하루 수십 건이라 모두 본다
  { method: "POST", path: /^\/v\d+\/webhooks\//, rate: 1 },
  // 계정 삭제는 드물고 끝까지 따라가야 한다
  { method: "DELETE", path: /^\/v\d+\/auth\/account$/, rate: 1 },
  // 로그인·토큰 갱신·OAuth
  { path: /^\/v\d+\/auth\//, rate: 0.25 },
  // AI 생성은 느리고 비싸 지연 분포를 자주 본다
  { path: /^\/v\d+\/(?:ai|quick-plans|voice-notes|action-plans)(?:\/|$)/, rate: 0.5 },
];

export const DEFAULT_HTTP_TRACE_RATE = 0.1;

/** 큐별 표본 비율. 매분 도는 큐는 낮게, 드물고 중요한 큐는 모두 본다. 없는 큐는 기본 비율이다. */
const JOB_TRACE_RATES: ReadonlyMap<string, number> = new Map([
  ["timezone-reminder.v1", 0.01],
  ["retention.v1", 0.01],
  ["push-delivery.v1", 0.01],
  ["notification.v1", 0.02],
  ["todo-reminder.v1", 0.02],
  ["account-purge.v1", 1],
  ["store-subscription-reconcile.v1", 1],
  ["invite-reward.v1", 1],
  ["todo-series-materialization.v1", 1],
  ["email-delivery.v1", 0.5],
  ["ai-report-generation.v1", 0.5],
]);

export const DEFAULT_JOB_TRACE_RATE = 0.05;

/** Sentry의 표본 문맥 중 결정에 쓰는 값. 앱이 이어 보낸 추적이면 parentSampled가 있다 */
export interface TraceSamplingInput {
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly parentSampled?: boolean;
}

/** 앱이 이어 보낸 추적은 앱의 결정을 따라 한 추적이 끊기지 않게 하고, 0인 경로는 앱이 보내도 남기지 않는다. */
export function sampleTrace(input: TraceSamplingInput, defaultHttpRate: number): number {
  const attributes = input.attributes ?? {};
  const queue = attributes[JOB_QUEUE_SPAN_ATTRIBUTE];
  const rate =
    typeof queue === "string"
      ? (JOB_TRACE_RATES.get(queue) ?? DEFAULT_JOB_TRACE_RATE)
      : httpTraceRate(attributes, defaultHttpRate);
  if (rate === 0 || input.parentSampled == null) {
    return rate;
  }
  return input.parentSampled ? 1 : 0;
}

function httpTraceRate(attributes: Readonly<Record<string, unknown>>, defaultRate: number): number {
  const path = attributes["url.path"];
  const method = attributes["http.request.method"];
  if (typeof path !== "string") {
    return defaultRate;
  }
  const rule = HTTP_TRACE_RULES.find(
    (candidate) =>
      candidate.path.test(path) && (candidate.method == null || candidate.method === method),
  );
  return rule?.rate ?? defaultRate;
}

const FILTERED_QUERY_VALUE = /token=[^&]+/gi;

/** 보내기 직전 마지막 정리. 수집 설정이 바뀌어도 인증 헤더·IP·본문·쿠키가 나가지 않게 한 번 더 지운다. */
export function scrubErrorEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request != null) {
    const { headers } = event.request;
    if (headers != null) {
      delete headers.authorization;
      delete headers.cookie;
      delete headers["x-forwarded-for"];
      delete headers["x-real-ip"];
    }
    delete event.request.data;
    delete event.request.cookies;
    if (typeof event.request.query_string === "string") {
      event.request.query_string = event.request.query_string.replace(
        FILTERED_QUERY_VALUE,
        "token=[FILTERED]",
      );
    }
  }
  if (event.user != null) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }
  return event;
}

/**
 * `beforeSend`. @sentry/nestjs는 `@OnEvent`·`@Cron` handler에서 던진 예외를 종류와 상관없이 잡아 보낸다.
 * 그 경로의 업무 거부(4xx로 정한 ApplicationException·DomainException)는 HTTP처럼 오류가 아니므로 버리고,
 * 나머지는 정리해 보낸다.
 */
export function beforeSendError(
  event: Sentry.ErrorEvent,
  hint: Sentry.EventHint,
): Sentry.ErrorEvent | null {
  return isBusinessRejection(hint.originalException) ? null : scrubErrorEvent(event);
}

const packageVersionSchema = z.object({ version: z.string().min(1) });

/** Sentry 릴리스 이름은 `/`를 쓸 수 없어 패키지 이름(@aido/server) 대신 고정 접두사를 쓴다 */
export function toSentryRelease(packageJson: unknown): string | undefined {
  const parsed = packageVersionSchema.safeParse(packageJson);
  return parsed.success ? `aido-server@${parsed.data.version}` : undefined;
}

/**
 * Sentry로 보내는 조건. 운영(APP_ENV 기준)이면서 DSN이 있을 때뿐이다.
 * SDK 초기화(instrument.ts)와 경보·예외 어댑터 선택(AlertingModule)이 같은 판정을 쓴다.
 */
export function isSentryEnabled(input: {
  readonly isProduction: boolean;
  readonly dsn: string | undefined;
}): boolean {
  return input.isProduction && input.dsn != null && input.dsn !== "";
}

export interface SentryInstrumentOptions {
  enabled: boolean;
  environment: AppEnvironment;
  tracesSampler: (input: TraceSamplingInput) => number;
  tracePropagationTargets: readonly RegExp[];
}

/** process.env 호환 — 필요한 키(APP_ENV/NODE_ENV/SENTRY_*)만 읽는다 */
type SentryEnvSource = Record<string, string | undefined>;

export function resolveSentryOptions(env: SentryEnvSource): SentryInstrumentOptions {
  const { environment, isProduction } = appConfig.parse(env);
  // 운영에서 비율을 잠시 바꿀 때 쓴다. 경로·큐별로 정한 비율은 그대로 두고 기본 HTTP 비율만 바꾼다
  const defaultHttpRate =
    env.SENTRY_TRACES_SAMPLE_RATE != null
      ? Number(env.SENTRY_TRACES_SAMPLE_RATE)
      : DEFAULT_HTTP_TRACE_RATE;

  return {
    enabled: isSentryEnabled({ isProduction, dsn: env.SENTRY_DSN }),
    environment,
    tracesSampler: (input) => sampleTrace(input, defaultHttpRate),
    tracePropagationTargets: TRACE_PROPAGATION_TARGETS,
  };
}
