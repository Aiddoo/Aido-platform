import type { InviteConfigPort } from "../ports/invite-config.port.js";

interface GetInviteAvailabilityDependencies {
  readonly inviteConfig: InviteConfigPort;
}

export class GetInviteAvailabilityUseCase {
  readonly #dependencies: GetInviteAvailabilityDependencies;

  constructor(dependencies: GetInviteAvailabilityDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): { enabled: boolean } {
    return { enabled: this.#dependencies.inviteConfig.isEnabled };
  }
}
