import type { IncomingMessage, ServerResponse } from "node:http";

import { Injectable } from "@nestjs/common";
import { type ClsMiddlewareOptions, ClsService, ClsServiceManager } from "nestjs-cls";

import { tagRequestScope } from "#api/platform/observability/sentry-scope";

import { parseRequestClient, type RequestClient } from "./request-client.js";
import { assignRequestId } from "./request-id.js";

const REQUEST_CLIENT_CLS_KEY = Symbol("REQUEST_CLIENT");

/**
 * 모든 HTTP 요청의 CLS context를 열고 guard·interceptor·controller보다 먼저 RequestClient를
 * 한 번 만든다. 요청 ID·앱 버전·플랫폼은 같은 요청의 Sentry 이벤트에도 태그로 붙는다.
 */
export const REQUEST_CLIENT_CLS_MIDDLEWARE: ClsMiddlewareOptions = {
  mount: true,
  setup: (cls: ClsService, request: IncomingMessage, response: ServerResponse) => {
    const client = parseRequestClient(request.headers, assignRequestId(request, response));
    storeRequestClient(cls, client);
    tagRequestScope(client);
  },
};

export function storeRequestClient(cls: ClsService, client: RequestClient): void {
  cls.set(REQUEST_CLIENT_CLS_KEY, client);
}

export function readRequestClient(
  cls: ClsService = ClsServiceManager.getClsService(),
): RequestClient {
  const client = cls.get<RequestClient | undefined>(REQUEST_CLIENT_CLS_KEY);
  if (client == null) {
    throw new Error("RequestClient is read outside an HTTP request context");
  }
  return client;
}

/** guard·interceptor·service가 현재 요청의 RequestClient를 주입받아 읽는다. */
@Injectable()
export class RequestClientReader {
  readonly #cls: ClsService;

  constructor(cls: ClsService) {
    this.#cls = cls;
  }

  current(): RequestClient {
    return readRequestClient(this.#cls);
  }
}
