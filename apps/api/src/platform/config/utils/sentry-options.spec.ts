import { ErrorCode } from "@aido/api/errors";
/**
 * resolveSentryOptions 단위 테스트
 *
 * @description
 * Sentry 활성화 여부를 배포 환경(APP_ENV) 기준으로 결정하는 규칙 검증.
 * 핵심: 개발서버는 production 빌드(NODE_ENV=production)로 돌기 때문에
 * NODE_ENV만으로는 구분할 수 없다 — APP_ENV가 배포 환경의 단일 진실.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/server test sentry-options
 * ```
 */
import * as Sentry from "@sentry/nestjs";

import { ApplicationException } from "#api/shared/application/application.exception";

import {
  beforeSendError,
  DEFAULT_HTTP_TRACE_RATE,
  DEFAULT_JOB_TRACE_RATE,
  JOB_QUEUE_SPAN_ATTRIBUTE,
  resolveSentryOptions,
  sampleTrace,
  scrubErrorEvent,
  SENTRY_DATA_COLLECTION,
} from "./sentry-options.js";

const DSN = "https://key@o0.ingest.sentry.io/0";

describe("resolveSentryOptions — Sentry 환경 게이트", () => {
  it("개발서버(production 빌드 + APP_ENV=development)에서는 비활성화된다", () => {
    // Given — 배포된 개발서버: production 빌드지만 개발 환경
    const options = resolveSentryOptions({
      APP_ENV: "development",
      NODE_ENV: "production",
      SENTRY_DSN: DSN,
    });

    // Then
    expect(options.enabled).toBe(false);
    expect(options.environment).toBe("development");
  });

  it("APP_ENV=production + DSN이면 활성화된다", () => {
    // When
    const options = resolveSentryOptions({
      APP_ENV: "production",
      NODE_ENV: "production",
      SENTRY_DSN: DSN,
    });

    // Then
    expect(options.enabled).toBe(true);
    expect(options.environment).toBe("production");
  });

  it("APP_ENV 미설정 시 NODE_ENV=production이면 production으로 폴백한다 (기존 프로덕션 하위호환)", () => {
    // Given — 기존 프로덕션 배포는 APP_ENV를 설정하지 않음
    const options = resolveSentryOptions({
      NODE_ENV: "production",
      SENTRY_DSN: DSN,
    });

    // Then — 배포 인프라 변경 없이 기존 알림 유지
    expect(options.enabled).toBe(true);
    expect(options.environment).toBe("production");
  });

  it("로컬 개발(NODE_ENV=development)에서는 비활성화된다", () => {
    // When
    const options = resolveSentryOptions({
      NODE_ENV: "development",
      SENTRY_DSN: DSN,
    });

    // Then
    expect(options.enabled).toBe(false);
    expect(options.environment).toBe("development");
  });

  it("production이어도 DSN이 없으면 비활성화된다", () => {
    // When
    const options = resolveSentryOptions({
      APP_ENV: "production",
      NODE_ENV: "production",
    });

    // Then
    expect(options.enabled).toBe(false);
  });

  it("staging은 이벤트를 보내지 않는다 (production만 발송)", () => {
    // When
    const options = resolveSentryOptions({
      APP_ENV: "staging",
      NODE_ENV: "production",
      SENTRY_DSN: DSN,
    });

    // Then
    expect(options.enabled).toBe(false);
    expect(options.environment).toBe("staging");
  });

  it("잘못된 APP_ENV 값은 설정 검증과 같이 거절한다", () => {
    // When
    const resolve = () =>
      resolveSentryOptions({ APP_ENV: "prod-typo", NODE_ENV: "production", SENTRY_DSN: DSN });

    // Then
    expect(resolve).toThrow();
  });

  describe("tracePropagationTargets — 외부 API 추적 헤더 차단", () => {
    const matches = (url: string) =>
      resolveSentryOptions({
        APP_ENV: "production",
      }).tracePropagationTargets.some((target) => target.test(url));

    it("우리 API로 나가는 요청에는 추적 헤더를 전파한다", () => {
      expect(matches("https://api.aido.kr/v1/todos")).toBe(true);
    });

    // 회귀 방지: Sentry가 붙이는 baggage 헤더를 data.go.kr 게이트웨이가
    // "잘못된 요청 파라미터 에러(코드 10)"로 거부해 날씨 API가 전부 503이 됐다.
    it.each([
      [
        "기상청 단기예보",
        "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
      ],
      [
        "한국천문연구원 일출",
        "https://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getAreaRiseSetInfo",
      ],
      [
        "에어코리아 대기질",
        "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty",
      ],
      ["Google Generative AI", "https://generativelanguage.googleapis.com/v1beta/models"],
      ["Resend 메일", "https://api.resend.com/emails"],
      ["Expo 푸시", "https://exp.host/--/api/v2/push/send"],
    ])("%s 요청에는 추적 헤더를 전파하지 않는다", (_label, url) => {
      expect(matches(url)).toBe(false);
    });
  });

  describe("tracesSampler", () => {
    it("SENTRY_TRACES_SAMPLE_RATE는 기본 HTTP 비율만 바꾸고 경로별 비율은 그대로 둔다", () => {
      // Given
      const { tracesSampler } = resolveSentryOptions({
        APP_ENV: "production",
        SENTRY_TRACES_SAMPLE_RATE: "0.05",
      });

      // When
      const todos = tracesSampler({ attributes: { "url.path": "/v1/todos" } });
      const webhook = tracesSampler({
        attributes: { "url.path": "/v1/webhooks/revenuecat", "http.request.method": "POST" },
      });

      // Then
      expect(todos).toBe(0.05);
      expect(webhook).toBe(1);
    });

    it("SENTRY_TRACES_SAMPLE_RATE를 비워 두면 0이 아니라 기본 HTTP 비율이다", () => {
      // Given
      const { tracesSampler } = resolveSentryOptions({
        APP_ENV: "production",
        SENTRY_TRACES_SAMPLE_RATE: "",
      });

      // When
      const todos = tracesSampler({ attributes: { "url.path": "/v1/todos" } });

      // Then
      expect(todos).toBe(DEFAULT_HTTP_TRACE_RATE);
    });
  });
});

describe("sampleTrace — 무료 플랜 span 한도 안의 경로·큐별 비율", () => {
  const http = (path: string, method = "GET") => ({
    attributes: { "url.path": path, "http.request.method": method },
  });

  it.each([
    { name: "상태 확인", input: http("/health"), rate: 0 },
    { name: "안 읽은 알림 수 조회", input: http("/v1/notifications/unread-count"), rate: 0 },
    { name: "앱 버전 조회", input: http("/v1/app-config/app-version"), rate: 0 },
    { name: "결제 웹훅", input: http("/v1/webhooks/revenuecat", "POST"), rate: 1 },
    { name: "계정 삭제", input: http("/v1/auth/account", "DELETE"), rate: 1 },
    { name: "토큰 갱신", input: http("/v1/auth/refresh", "POST"), rate: 0.25 },
    { name: "AI 할 일 파싱", input: http("/v1/ai/parse-todo", "POST"), rate: 0.5 },
    { name: "그 밖의 경로", input: http("/v1/todos"), rate: DEFAULT_HTTP_TRACE_RATE },
    {
      name: "매분 도는 시간대 리마인더 큐",
      input: { attributes: { [JOB_QUEUE_SPAN_ATTRIBUTE]: "timezone-reminder.v1" } },
      rate: 0.01,
    },
    {
      name: "계정 영구 삭제 큐",
      input: { attributes: { [JOB_QUEUE_SPAN_ATTRIBUTE]: "account-purge.v1" } },
      rate: 1,
    },
    {
      name: "비율을 정하지 않은 큐",
      input: { attributes: { [JOB_QUEUE_SPAN_ATTRIBUTE]: "new-queue.v1" } },
      rate: DEFAULT_JOB_TRACE_RATE,
    },
    {
      name: "경로도 큐도 없는 루트 span(타이머·Redis·pg 폴링)",
      input: { attributes: { "db.system.name": "redis" } },
      rate: 0,
    },
    { name: "속성이 없는 루트 span", input: {}, rate: 0 },
  ])("$name → $rate", ({ input, rate }) => {
    // When
    const sampled = sampleTrace(input, DEFAULT_HTTP_TRACE_RATE);

    // Then
    expect(sampled).toBe(rate);
  });

  it("앱이 이어 보낸 추적은 앱의 결정을 따른다", () => {
    // When
    const continued = sampleTrace({ ...http("/v1/todos"), parentSampled: true }, 0.1);
    const dropped = sampleTrace({ ...http("/v1/todos"), parentSampled: false }, 0.1);

    // Then
    expect([continued, dropped]).toEqual([1, 0]);
  });

  it("상태 확인처럼 비율 0인 경로는 Uptime·앱이 보낸 추적 헤더가 표본으로 골라도 남기지 않는다", () => {
    // When
    const sampled = sampleTrace({ ...http("/health"), parentSampled: true }, 0.1);

    // Then
    expect(sampled).toBe(0);
  });
});

describe("Sentry 수집 범위 — 사용자 원문이 나가지 않게", () => {
  afterEach(async () => {
    await Sentry.close();
  });

  it("본문·DB 바인딩 값·스택 지역 변수·쿠키·쿼리를 모으지 않는다", () => {
    // Given
    Sentry.init({
      dsn: "https://public@o0.ingest.sentry.io/0",
      dataCollection: SENTRY_DATA_COLLECTION,
      transport: () => ({ send: async () => ({}), flush: async () => true }),
    });

    // When
    const collected = Sentry.getClient()?.getDataCollectionOptions();

    // Then
    expect(collected).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    });
  });

  it("보내기 직전에 인증 헤더·IP·본문·이메일을 한 번 더 지운다", () => {
    // Given
    const event: Sentry.ErrorEvent = {
      type: undefined,
      request: {
        headers: { authorization: "Bearer secret", "x-real-ip": "1.2.3.4", "user-agent": "app" },
        data: { title: "병원 예약" },
        query_string: "token=abc&page=1",
      },
      user: { id: "user-1", email: "a@b.c", ip_address: "1.2.3.4" },
    };

    // When
    const scrubbed = scrubErrorEvent(event);

    // Then
    expect(scrubbed.request).toEqual({
      headers: { "user-agent": "app" },
      query_string: "token=[FILTERED]&page=1",
    });
    expect(scrubbed.user).toEqual({ id: "user-1" });
  });

  it("메시지 이벤트와 breadcrumb 글의 이메일도 지우고 패키지 버전은 남긴다", () => {
    // Given
    const event: Sentry.ErrorEvent = {
      type: undefined,
      message: "a@example.com 로그인 실패",
      breadcrumbs: [{ message: "메일 보냄 b@example.co.kr" }, { category: "http" }],
      exception: { values: [{ value: "@tanstack/query-core@5.105.3 실패: c@example.com" }] },
    };

    // When
    const scrubbed = scrubErrorEvent(event);

    // Then
    expect(scrubbed.message).toBe("[FILTERED] 로그인 실패");
    expect(scrubbed.breadcrumbs).toEqual([
      { message: "메일 보냄 [FILTERED]" },
      { category: "http" },
    ]);
    expect(scrubbed.exception?.values?.[0]?.value).toBe(
      "@tanstack/query-core@5.105.3 실패: [FILTERED]",
    );
  });
});

describe("beforeSendError — 업무 거부는 어느 경로에서도 오류로 보내지 않는다", () => {
  afterEach(async () => {
    await Sentry.close();
  });

  it("@OnEvent handler·작업에서 자동 수집된 4xx 업무 거부는 버리고 장애는 보낸다", async () => {
    // Given - @sentry/nestjs가 이벤트 handler 예외를 잡는 것과 같은 captureException 경로다
    const passed: unknown[] = [];
    Sentry.init({
      dsn: "https://public@o0.ingest.sentry.io/0",
      beforeSend: (event, hint) => {
        if (beforeSendError(event, hint) != null) {
          passed.push(hint.originalException);
        }
        return null;
      },
    });
    const rejected = new ApplicationException(ErrorCode.SUBSCRIPTION_1602);
    const outage = new ApplicationException(ErrorCode.AI_1301);
    const bug = new TypeError("boom");

    // When
    for (const error of [rejected, outage, bug]) {
      Sentry.captureException(error);
    }
    await Sentry.flush(1000);

    // Then - 이벤트 처리는 비동기라 순서는 보지 않는다
    expect(passed).toHaveLength(2);
    expect(passed).toEqual(expect.arrayContaining([outage, bug]));
  });

  it("cause로 이어 보낸 DB 오류의 바인딩 값과 이메일은 예외 메시지에서 지운다", async () => {
    // Given - userTagCollided처럼 DrizzleQueryError를 cause로 실은 장애다
    const events: Sentry.ErrorEvent[] = [];
    Sentry.init({
      dsn: "https://public@o0.ingest.sentry.io/0",
      beforeSend: (event, hint) => {
        const scrubbed = beforeSendError(event, hint);
        if (scrubbed != null) {
          events.push(scrubbed);
        }
        return null;
      },
    });
    const dbError = new Error(
      'Failed query: insert into "users" ("email", "user_tag") values ($1, $2)\nparams: a@b.com,TAG2025',
    );
    const outage = new ApplicationException(ErrorCode.SYS_0001, undefined, { cause: dbError });

    // When
    Sentry.captureException(outage);
    Sentry.captureException(new Error("user a@b.com failed"));
    await Sentry.flush(1000);

    // Then
    const values = events.flatMap((event) => event.exception?.values ?? []).map((v) => v.value);
    expect(values).toContain(
      'Failed query: insert into "users" ("email", "user_tag") values ($1, $2)\nparams: [FILTERED]',
    );
    expect(values).toContain("user [FILTERED] failed");
    expect(values.join("\n")).not.toContain("a@b.com");
  });
});
