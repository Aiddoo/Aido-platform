import type { RevenueCatWebhookPayload } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { HandleWebhookEventUseCase } from "../use-cases/handle-webhook-event/handle-webhook-event.use-case";

/**
 * 구독 Facade.
 *
 * 컨트롤러의 유일한 주입 대상. RevenueCat 웹훅 이벤트 처리 use-case로 위임한다.
 */
@Injectable()
export class SubscriptionFacade {
	constructor(
		private readonly handleWebhookEventUseCase: HandleWebhookEventUseCase,
	) {}

	handleWebhookEvent(payload: RevenueCatWebhookPayload): Promise<void> {
		return this.handleWebhookEventUseCase.execute(payload);
	}
}
