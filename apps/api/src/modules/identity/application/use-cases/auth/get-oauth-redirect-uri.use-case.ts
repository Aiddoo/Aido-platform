import type { AuthOAuthStateRepositoryPort } from "../../ports/auth/auth-persistence.port.js";

export interface GetOAuthRedirectUriInput {
  readonly state: string;
}

interface GetOAuthRedirectUriDependencies {
  readonly oauthStateRepository: Pick<AuthOAuthStateRepositoryPort, "findByState">;
}

export class GetOAuthRedirectUri {
  readonly #dependencies: GetOAuthRedirectUriDependencies;

  constructor(dependencies: GetOAuthRedirectUriDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetOAuthRedirectUriInput): Promise<string | null> {
    const state = await this.#dependencies.oauthStateRepository.findByState(input.state);
    return state?.redirectUri ?? null;
  }
}
