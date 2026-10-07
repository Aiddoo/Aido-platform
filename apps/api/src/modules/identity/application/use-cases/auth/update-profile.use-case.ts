import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface UpdateProfileDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class UpdateProfile {
  readonly #dependencies: UpdateProfileDependencies;

  constructor(dependencies: UpdateProfileDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<CredentialAuthWorkflow["updateProfile"]>[0],
    input: Parameters<CredentialAuthWorkflow["updateProfile"]>[1],
  ): ReturnType<CredentialAuthWorkflow["updateProfile"]> {
    return this.#dependencies.workflow.updateProfile(userId, input);
  }
}
