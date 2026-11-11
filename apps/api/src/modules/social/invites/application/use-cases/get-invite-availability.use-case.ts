import type { InviteConfigPort } from "../ports/invite-config.port.js";

export interface GetInviteAvailabilityDependencies {
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
}

export class GetInviteAvailabilityUseCase {
  readonly #dependencies: GetInviteAvailabilityDependencies;

  constructor(dependencies: GetInviteAvailabilityDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): boolean {
    return this.#dependencies.inviteConfig.isEnabled;
  }
}
