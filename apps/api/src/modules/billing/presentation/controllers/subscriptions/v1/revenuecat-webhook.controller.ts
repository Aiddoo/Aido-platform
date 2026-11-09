import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "#api/modules/identity/identity-auth-http.public";

import { WebhookSignatureGuard } from "../../../../infrastructure/guards/subscriptions/webhook-signature.guard.js";
import { RevenueCatWebhookReceiver } from "../../../../infrastructure/revenuecat/revenuecat-webhook.receiver.js";

// RevenueCat 대시보드에 등록된 운영 URL이라 경로를 바꾸지 않는다. non-2xx면 RevenueCat이 다시 보낸다
@Controller("webhooks")
@SkipThrottle()
export class RevenueCatWebhookController {
  constructor(private readonly receiver: RevenueCatWebhookReceiver) {}

  @Post("revenuecat")
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiExcludeEndpoint()
  @UseGuards(WebhookSignatureGuard)
  receive(@Body() body: unknown): Promise<{ received: true }> {
    return this.receiver.receive({ body });
  }
}
