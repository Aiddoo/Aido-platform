import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "#api/modules/identity/sessions/identity-sessions.public";
import { API_VERSION } from "#api/platform/http/api-versioning";

import { StoreWebhookPort } from "../../../application/ports/store-webhook.port.js";
import { ApplyStoreSubscriptionEventUseCase } from "../../../application/use-cases/apply-store-subscription-event.use-case.js";
import { StoreWebhookGuard } from "../guards/store-webhook.guard.js";

// RevenueCat 대시보드에 등록된 운영 URL이라 경로를 바꾸지 않는다. non-2xx면 RevenueCat이 다시 보낸다
@Controller({ path: "webhooks", version: API_VERSION.V1 })
@SkipThrottle()
export class RevenueCatWebhookController {
  readonly #storeWebhook: Pick<StoreWebhookPort, "translate">;
  readonly #applyStoreSubscriptionEvent: Pick<ApplyStoreSubscriptionEventUseCase, "execute">;

  constructor(
    storeWebhook: StoreWebhookPort,
    applyStoreSubscriptionEvent: ApplyStoreSubscriptionEventUseCase,
  ) {
    this.#storeWebhook = storeWebhook;
    this.#applyStoreSubscriptionEvent = applyStoreSubscriptionEvent;
  }

  @Post("revenuecat")
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiExcludeEndpoint()
  @UseGuards(StoreWebhookGuard)
  async receive(@Body() body: unknown): Promise<{ received: true }> {
    const event = this.#storeWebhook.translate(body);
    if (event != null) {
      await this.#applyStoreSubscriptionEvent.execute(event);
    }
    return { received: true };
  }
}
