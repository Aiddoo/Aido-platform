import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface RefreshTokensDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class RefreshTokens {
  readonly #dependencies: RefreshTokensDependencies;

  constructor(dependencies: RefreshTokensDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    refreshToken: Parameters<CredentialAuthWorkflow["refreshTokens"]>[0],
    verifiedPayload: Parameters<CredentialAuthWorkflow["refreshTokens"]>[1],
    metadata?: Parameters<CredentialAuthWorkflow["refreshTokens"]>[2],
  ): ReturnType<CredentialAuthWorkflow["refreshTokens"]> {
    return this.#dependencies.workflow.refreshTokens(refreshToken, verifiedPayload, metadata);
  }
}
