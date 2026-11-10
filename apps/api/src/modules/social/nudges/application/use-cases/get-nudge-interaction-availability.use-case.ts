import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";

export interface NudgeInteractionAvailability {
  readonly enabled: boolean;
}

export interface GetNudgeInteractionAvailabilityDependencies {
  readonly interactionConfig: NudgeInteractionConfigPort;
}

export class GetNudgeInteractionAvailabilityUseCase {
  readonly #dependencies: GetNudgeInteractionAvailabilityDependencies;

  constructor(dependencies: GetNudgeInteractionAvailabilityDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): NudgeInteractionAvailability {
    return { enabled: this.#dependencies.interactionConfig.isEnabled };
  }
}
