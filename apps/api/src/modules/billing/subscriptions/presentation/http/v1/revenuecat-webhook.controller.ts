import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "#api/modules/identity/identity-auth-http.public";
import { API_VERSION } from "#api/platform/http/api-versioning";

import { RevenueCatWebhookReceiver } from "../../../infrastructure/adapters/revenuecat/revenuecat-webhook-receiver.adapter.js";
import { RevenueCatWebhookSignatureGuard } from "../../../infrastructure/adapters/revenuecat/revenuecat-webhook-signature.guard.js";

// RevenueCat 대시보드에 등록된 운영 URL이라 경로를 바꾸지 않는다. non-2xx면 RevenueCat이 다시 보낸다
@Controller({ path: "webhooks", version: API_VERSION.V1 })
@SkipThrottle()
export class RevenueCatWebhookController {
  readonly #receiver: RevenueCatWebhookReceiver;

  constructor(receiver: RevenueCatWebhookReceiver) {
    this.#receiver = receiver;
  }

  @Post("revenuecat")
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiExcludeEndpoint()
  @UseGuards(RevenueCatWebhookSignatureGuard)
  receive(@Body() body: unknown): Promise<{ received: true }> {
    return this.#receiver.receive({ body });
  }
}
