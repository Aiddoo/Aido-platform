import type { ClockPort } from "#api/shared/application/ports/clock.port";

import type { AuthOAuthStateRepositoryPort } from "../ports/auth-oauth-state.repository.port.js";

export interface GetOAuthRedirectUriQuery {
  readonly state: string;
}

interface GetOAuthRedirectUriDependencies {
  readonly oauthStateRepository: Pick<AuthOAuthStateRepositoryPort, "findByState">;
  readonly clock: ClockPort;
}

export class GetOAuthRedirectUriUseCase {
  readonly #dependencies: GetOAuthRedirectUriDependencies;

  constructor(dependencies: GetOAuthRedirectUriDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetOAuthRedirectUriQuery): Promise<string | null> {
    const state = await this.#dependencies.oauthStateRepository.findByState(
      input.state,
      this.#dependencies.clock.now(),
    );
    return state?.redirectUri ?? null;
  }
}
