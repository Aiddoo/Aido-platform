import { type NudgeInteractionConfigPort } from "../../ports/nudges/nudge-interaction.config.port.js";

interface GetNudgeInteractionAvailabilityDependencies {
  readonly nudgeInteractionConfig: NudgeInteractionConfigPort;
}

export class GetNudgeInteractionAvailability {
  readonly #dependencies: GetNudgeInteractionAvailabilityDependencies;

  constructor(dependencies: GetNudgeInteractionAvailabilityDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): { enabled: boolean } {
    return { enabled: this.#dependencies.nudgeInteractionConfig.isEnabled };
  }
}
