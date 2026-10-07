import type { PasswordWorkflow } from "../../workflows/auth/password.workflow.js";

interface ResetPasswordDependencies {
  readonly workflow: PasswordWorkflow;
}

export class ResetPassword {
  readonly #dependencies: ResetPasswordDependencies;

  constructor(dependencies: ResetPasswordDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    email: Parameters<PasswordWorkflow["resetPassword"]>[0],
    code: Parameters<PasswordWorkflow["resetPassword"]>[1],
    newPassword: Parameters<PasswordWorkflow["resetPassword"]>[2],
  ): ReturnType<PasswordWorkflow["resetPassword"]> {
    return this.#dependencies.workflow.resetPassword(email, code, newPassword);
  }
}
