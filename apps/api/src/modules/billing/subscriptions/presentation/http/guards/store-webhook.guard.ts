import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";

import type { HttpRequest } from "#api/platform/http/http-request";

import { StoreWebhookPort } from "../../../application/ports/store-webhook.port.js";
import { invalidWebhookSignature } from "../../../application/subscriptions.errors.js";

// 인증 실패는 인터셉터·핸들러보다 먼저 거절해 공급자가 보낸 요청만 웹훅 처리 로그에 남긴다
@Injectable()
export class StoreWebhookGuard implements CanActivate {
  readonly #storeWebhook: Pick<StoreWebhookPort, "authenticate">;

  constructor(storeWebhook: StoreWebhookPort) {
    this.#storeWebhook = storeWebhook;
  }

  canActivate(context: ExecutionContext): boolean {
    const { headers } = context.switchToHttp().getRequest<HttpRequest>();
    if (!this.#storeWebhook.authenticate(headers)) {
      throw invalidWebhookSignature();
    }
    return true;
  }
}
