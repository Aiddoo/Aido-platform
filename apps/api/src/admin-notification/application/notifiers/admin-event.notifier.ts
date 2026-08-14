import { Injectable, Logger } from "@nestjs/common";
import type { SubscriptionEventPayload } from "@/subscription";
import type { UserRegisteredEventPayload } from "../../domain/types/user-registered.payload";
import { EnqueueSubscriptionEventUseCase } from "../use-cases/enqueue-subscription-event/enqueue-subscription-event.use-case";
import { EnqueueUserRegisteredUseCase } from "../use-cases/enqueue-user-registered/enqueue-user-registered.use-case";

/** 운영 흐름과 격리된 관리자 이벤트 알림 큐 진입점. */
@Injectable()
export class AdminEventNotifier {
	readonly #logger = new Logger(AdminEventNotifier.name);

	constructor(
		private readonly enqueueUserRegistered: EnqueueUserRegisteredUseCase,
		private readonly enqueueSubscriptionEvent: EnqueueSubscriptionEventUseCase,
	) {}

	notifyUserRegistered(payload: UserRegisteredEventPayload): void {
		this.enqueueUserRegistered.execute(payload).catch((error) => {
			this.#logger.error(
				`Failed to enqueue user-registered notification: userId=${payload.userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	notifySubscriptionEvent(payload: SubscriptionEventPayload): void {
		this.enqueueSubscriptionEvent.execute(payload).catch((error) => {
			this.#logger.error(
				`Failed to enqueue subscription notification: userId=${payload.userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}
}
