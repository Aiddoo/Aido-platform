import { Inject, Injectable, Logger } from "@nestjs/common";

import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "../../ports/marketing-push-opt-out-token.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../ports/user-notification-settings.port";

@Injectable()
export class OptOutMarketingPushUseCase {
	readonly #logger = new Logger(OptOutMarketingPushUseCase.name);
	constructor(
		@Inject(MARKETING_PUSH_OPT_OUT_TOKEN)
		private readonly tokens: MarketingPushOptOutTokenPort,
		@Inject(USER_NOTIFICATION_SETTINGS)
		private readonly settings: UserNotificationSettingsPort,
	) {}

	async execute(token: string): Promise<boolean> {
		const userId = this.tokens.verify(token);
		if (!userId) return false;
		await this.settings.updateMarketingPushConsent(userId, false);
		this.#logger.log(`Marketing push opted out: userId=${userId}`);
		return true;
	}
}
