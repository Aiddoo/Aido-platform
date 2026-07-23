import { Injectable } from "@nestjs/common";

import { HandleWebhookEventUseCase } from "../use-cases/handle-webhook-event/handle-webhook-event.use-case";

/**
 * 구독 Facade.
 *
 * 컨트롤러의 유일한 주입 대상. RevenueCat 웹훅 이벤트 처리 use-case로 위임한다.
 * 검증·오케스트레이션은 use-case가 소유하므로 원시 본문(unknown)을 그대로 전달한다.
 */
@Injectable()
export class SubscriptionFacade {
	constructor(
		private readonly handleWebhookEventUseCase: HandleWebhookEventUseCase,
	) {}

	handleWebhookEvent(body: unknown): Promise<{ received: true }> {
		return this.handleWebhookEventUseCase.execute(body);
	}
}
