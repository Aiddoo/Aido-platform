import type { PasswordWorkflow } from "../../workflows/auth/password.workflow.js";

interface RequestPasswordResetDependencies {
  readonly workflow: PasswordWorkflow;
}

export class RequestPasswordReset {
  readonly #dependencies: RequestPasswordResetDependencies;

  constructor(dependencies: RequestPasswordResetDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    email: Parameters<PasswordWorkflow["forgotPassword"]>[0],
    metadata?: Parameters<PasswordWorkflow["forgotPassword"]>[1],
  ): ReturnType<PasswordWorkflow["forgotPassword"]> {
    return this.#dependencies.workflow.forgotPassword(email, metadata);
  }
}
