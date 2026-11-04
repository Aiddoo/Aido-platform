import { createParamDecorator } from "@nestjs/common";

import type { RequestClient } from "./request-client.js";
import { readRequestClient } from "./request-client.store.js";

/** `@CurrentRequestClient() client: RequestClient` — 요청당 한 번 정규화한 앱 헤더 */
export const CurrentRequestClient = createParamDecorator<undefined, RequestClient>(() =>
  readRequestClient(),
);

/**
 * SemVer X-App-Version. 없거나 형식이 틀리면 undefined라 버전 분기는 구 앱 동작을 따른다.
 * `isSemanticVersionAtLeast`로만 비교하는 응답 mapper가 `appVersion?: string`을 받는다.
 */
export const AppVersion = createParamDecorator<undefined, string | undefined>(
  () => readRequestClient().appVersion ?? undefined,
);
