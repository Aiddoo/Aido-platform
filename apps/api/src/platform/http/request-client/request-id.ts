import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { z } from "zod";

export const REQUEST_ID_HEADER = "X-Request-Id";

const requestIdSchema = z.uuid();

/**
 * 요청 ID를 정하고 응답 헤더로 돌려준다. 앱이 보낸 UUID는 그대로 이어 쓰고, 없거나 형식이
 * 틀리면 새로 만든다. pino-http와 CLS middleware가 모두 부르므로 먼저 정한 `req.id`를 재사용한다.
 */
export function assignRequestId(request: IncomingMessage, response: ServerResponse): string {
  if (typeof request.id === "string") {
    return request.id;
  }

  const incoming = requestIdSchema.safeParse(request.headers[REQUEST_ID_HEADER.toLowerCase()]);
  const requestId = incoming.success ? incoming.data : randomUUID();
  request.id = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}
