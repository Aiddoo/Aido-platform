import type { IncomingHttpHeaders } from "node:http";

import { ClsServiceManager } from "nestjs-cls";

import { parseRequestClient } from "#api/platform/http/request-client/request-client";
import { RequestClientReader } from "#api/platform/http/request-client/request-client.store";
import { storeRequestClient } from "#api/platform/http/request-client/request-client.store";

export const TEST_REQUEST_ID = "00000000-0000-4000-8000-000000000001";

/** HTTP middleware와 같은 CLS 저장 형식으로 요청 헤더를 RequestClient로 두고 실행한다. */
export function runWithRequestHeaders<T>(headers: IncomingHttpHeaders, work: () => T): T {
  const cls = ClsServiceManager.getClsService();
  return cls.run(() => {
    storeRequestClient(cls, parseRequestClient(headers, TEST_REQUEST_ID));
    return work();
  });
}

export function createRequestClientReader(): RequestClientReader {
  return new RequestClientReader(ClsServiceManager.getClsService());
}
