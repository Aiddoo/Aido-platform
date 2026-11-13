import type { NudgeInteractionConfigPort } from "../ports/nudge-interaction-config.port.js";
import type { NudgeInteractionAvailabilityReadModel } from "../read-models/nudge-interaction.read-model.js";

export interface GetNudgeInteractionAvailabilityDependencies {
  readonly interactionConfig: NudgeInteractionConfigPort;
}

export class GetNudgeInteractionAvailabilityUseCase {
  readonly #dependencies: GetNudgeInteractionAvailabilityDependencies;

  constructor(dependencies: GetNudgeInteractionAvailabilityDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): NudgeInteractionAvailabilityReadModel {
    return { enabled: this.#dependencies.interactionConfig.isEnabled };
  }
}
