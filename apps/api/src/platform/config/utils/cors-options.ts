import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { uniq } from "es-toolkit";

import { REQUEST_ID_HEADER } from "#api/platform/http/request-client/request-id";

const LOCAL_DEVELOPMENT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:19000",
  "http://localhost:19006",
];

// 랜딩의 초대 미리보기(aido.kr/i/{code})가 공개 API를 브라우저에서 부른다
const PUBLIC_WEB_ORIGINS = ["https://aido.kr", "https://www.aido.kr"];

// 앱·웹의 Sentry가 보낸 추적을 서버 span이 이어 받는다. 값은 추적 ID·표본 결정뿐이다
const TRACE_CONTINUATION_HEADERS = ["sentry-trace", "baggage"];

export function createCorsOptions(input: {
  readonly corsOrigins: readonly string[];
  readonly localCorsOrigins: boolean;
}): CorsOptions {
  return {
    origin: uniq([
      ...input.corsOrigins,
      ...PUBLIC_WEB_ORIGINS,
      ...(input.localCorsOrigins ? LOCAL_DEVELOPMENT_ORIGINS : []),
    ]),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Timezone",
      "X-App-Version",
      "X-Device-Type",
      "X-Device-Name",
      "X-OS-Version",
      "X-App-Build",
      REQUEST_ID_HEADER,
      ...TRACE_CONTINUATION_HEADERS,
    ],
    exposedHeaders: [REQUEST_ID_HEADER],
  };
}
