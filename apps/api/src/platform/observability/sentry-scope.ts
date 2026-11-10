import * as Sentry from "@sentry/nestjs";

import { SENTRY_TAG } from "./sentry-keys.js";

/** 같은 요청에서 나온 Sentry 이벤트를 앱 breadcrumb·서버 로그와 같은 요청 ID로 찾게 한다. */
export function tagRequestId(requestId: string): void {
  Sentry.setTag(SENTRY_TAG.REQUEST_ID, requestId);
}

/** 종료 직전에 남은 이벤트를 보낸다. 시간 안에 못 보내면 false다. */
export function flushExceptionReports(timeoutMs: number): Promise<boolean> {
  return Sentry.close(timeoutMs);
}
