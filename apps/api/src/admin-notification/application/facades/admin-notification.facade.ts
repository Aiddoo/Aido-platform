import { Injectable, Logger } from "@nestjs/common";

import type { SubscriptionEventPayload } from "@/subscription";

import type { UserRegisteredEventPayload } from "../../domain/types/user-registered.payload";
import { EnqueueSubscriptionEventUseCase } from "../use-cases/enqueue-subscription-event/enqueue-subscription-event.use-case";
import { EnqueueUserRegisteredUseCase } from "../use-cases/enqueue-user-registered/enqueue-user-registered.use-case";

/**
 * 관리자 알림 파사드.
 *
 * 크로스모듈(auth·subscription) 소비자의 유일한 주입 대상.
 * 큐 등록은 fire-and-forget(void) — 실패는 삼켜 로깅하고 호출자에 전파하지 않는다.
 */
@Injectable()
export class AdminNotificationFacade {
	readonly #logger = new Logger(AdminNotificationFacade.name);

	constructor(
		private readonly enqueueUserRegistered: EnqueueUserRegisteredUseCase,
		private readonly enqueueSubscriptionEvent: EnqueueSubscriptionEventUseCase,
	) {}

	/**
	 * 회원가입 관리자 알림 잡 등록 (fire-and-forget)
	 */
	notifyUserRegistered(payload: UserRegisteredEventPayload): void {
		this.enqueueUserRegistered.execute(payload).catch((error) => {
			this.#logger.error(
				`Failed to enqueue user-registered notification: userId=${payload.userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	/**
	 * 구독 이벤트 관리자 알림 잡 등록 (fire-and-forget)
	 */
	notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
		this.enqueueSubscriptionEvent.execute(payload).catch((error) => {
			this.#logger.error(
				`Failed to enqueue subscription notification: userId=${payload.userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}
}
