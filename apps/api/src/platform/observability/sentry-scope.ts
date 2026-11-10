import * as Sentry from "@sentry/nestjs";

import { JOB_QUEUE_SPAN_ATTRIBUTE } from "#api/platform/config/utils/sentry-options";

import { SENTRY_TAG } from "./sentry-keys.js";

const UNKNOWN = "unknown";

/** 요청마다 정해지는 문맥. 기기 이름·시간대·사용자 원문은 싣지 않는다. */
export interface RequestScope {
  readonly requestId: string;
  readonly appVersion: string | null;
  readonly platform: string | null;
}

/**
 * 같은 요청에서 나온 Sentry 이벤트·span을 앱 breadcrumb·서버 로그와 같은 요청 ID로 찾게 하고,
 * 앱 버전·플랫폼별로 거를 수 있게 한다. 요청마다 Sentry가 따로 연 isolation scope에 쓴다.
 */
export function tagRequestScope(request: RequestScope): void {
  Sentry.setTags({
    [SENTRY_TAG.REQUEST_ID]: request.requestId,
    [SENTRY_TAG.APP_VERSION]: request.appVersion ?? UNKNOWN,
    [SENTRY_TAG.PLATFORM]: request.platform ?? UNKNOWN,
  });
}

/** 라우팅·인증이 끝난 뒤 경로 템플릿과 사용자 ID를 싣는다. 이메일·이름은 싣지 않는다. */
export function tagRequestRoute(input: {
  readonly method: string;
  readonly route: string | null;
  readonly userId: string | null;
}): void {
  Sentry.setTag(SENTRY_TAG.HTTP_METHOD, input.method);
  if (input.route != null) {
    Sentry.setTag(SENTRY_TAG.HTTP_ROUTE, input.route);
  }
  Sentry.setUser(input.userId == null ? null : { id: input.userId });
}

/** 작업 하나(또는 한 번에 받은 묶음)의 문맥. payload는 사용자 값이 섞여 싣지 않는다. */
export interface JobScope {
  readonly queue: string;
  readonly jobName: string;
  readonly jobId: string;
  readonly attempt: number;
  readonly batchSize: number;
}

/**
 * 작업 처리를 요청처럼 따로 된 scope와 `queue.process` span으로 감싼다. 처리 중 올린 경보·예외에 큐·작업 태그가
 * 붙고, 큐별 지연을 Sentry Performance에서 본다. 표본 비율은 sentry-options의 JOB_TRACE_RATES가 정한다.
 */
export function withJobScope<T>(job: JobScope, run: () => Promise<T>): Promise<T> {
  return Sentry.withIsolationScope((scope) => {
    scope.setTags({
      [SENTRY_TAG.JOB_QUEUE]: job.queue,
      [SENTRY_TAG.JOB_NAME]: job.jobName,
      [SENTRY_TAG.JOB_ID]: job.jobId,
      [SENTRY_TAG.JOB_ATTEMPT]: String(job.attempt),
    });
    return Sentry.startSpan(
      {
        name: job.queue,
        op: "queue.process",
        forceTransaction: true,
        attributes: {
          [JOB_QUEUE_SPAN_ATTRIBUTE]: job.queue,
          "messaging.system": "pg-boss",
          "messaging.batch.message_count": job.batchSize,
        },
      },
      run,
    );
  });
}

/** 종료 직전에 남은 이벤트를 보낸다. 시간 안에 못 보내면 false다. */
export function flushExceptionReports(timeoutMs: number): Promise<boolean> {
  return Sentry.close(timeoutMs);
}
