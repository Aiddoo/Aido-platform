import { createParamDecorator } from "@nestjs/common";

import { idempotencyKeyRequired } from "#api/platform/http/http-request.errors";

import { readRequestClient } from "../request-client/request-client.store.js";

/** 재시도해도 한 번만 처리해야 하는 요청의 필수 키. 없거나 형식이 틀리면 처리 전에 AI_1316으로 막는다. */
export const IdempotencyKey = createParamDecorator<undefined, string>(() => {
  const { idempotencyKey } = readRequestClient();
  if (idempotencyKey == null) {
    throw idempotencyKeyRequired();
  }
  return idempotencyKey;
});
