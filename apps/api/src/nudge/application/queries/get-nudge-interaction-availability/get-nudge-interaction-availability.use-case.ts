import { Inject, Injectable } from "@nestjs/common";

import {
	NUDGE_INTERACTION_CONFIG,
	type NudgeInteractionConfigPort,
} from "../../ports/nudge-interaction.config.port.js";

@Injectable()
export class GetNudgeInteractionAvailabilityUseCase {
	constructor(
		@Inject(NUDGE_INTERACTION_CONFIG)
		private readonly nudgeInteractionConfig: NudgeInteractionConfigPort,
	) {}

	execute(): { enabled: boolean } {
		return { enabled: this.nudgeInteractionConfig.isEnabled };
	}
}
