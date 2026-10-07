import type { CredentialAuthWorkflow } from "../../workflows/auth/credential-auth.workflow.js";

interface ResendVerificationDependencies {
  readonly workflow: CredentialAuthWorkflow;
}

export class ResendVerification {
  readonly #dependencies: ResendVerificationDependencies;

  constructor(dependencies: ResendVerificationDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    email: Parameters<CredentialAuthWorkflow["resendVerification"]>[0],
  ): ReturnType<CredentialAuthWorkflow["resendVerification"]> {
    return this.#dependencies.workflow.resendVerification(email);
  }
}
