import { createParamDecorator } from "@nestjs/common";

import { readRequestClient } from "../request-client/request-client.store.js";
import { requestTimezoneIfSent, requestTimezoneOrUtc } from "../request-client/request-timezone.js";

export interface TimezoneDecoratorOptions {
  /** 헤더 누락/오류 시 UTC를 쓰지 않고 기존 저장값을 유지한다. */
  readonly preserveIfMissing?: boolean;
}

export const Timezone = createParamDecorator<
  TimezoneDecoratorOptions | undefined,
  string | undefined
>((options): string | undefined => {
  const client = readRequestClient();
  return options?.preserveIfMissing ? requestTimezoneIfSent(client) : requestTimezoneOrUtc(client);
});
