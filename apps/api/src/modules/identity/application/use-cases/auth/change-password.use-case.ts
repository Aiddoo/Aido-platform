import type { PasswordWorkflow } from "../../workflows/auth/password.workflow.js";

interface ChangePasswordDependencies {
  readonly workflow: PasswordWorkflow;
}

export class ChangePassword {
  readonly #dependencies: ChangePasswordDependencies;

  constructor(dependencies: ChangePasswordDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<PasswordWorkflow["changePassword"]>[0],
    currentPassword: Parameters<PasswordWorkflow["changePassword"]>[1],
    newPassword: Parameters<PasswordWorkflow["changePassword"]>[2],
    metadata?: Parameters<PasswordWorkflow["changePassword"]>[3],
    currentSessionId?: Parameters<PasswordWorkflow["changePassword"]>[4],
  ): ReturnType<PasswordWorkflow["changePassword"]> {
    return this.#dependencies.workflow.changePassword(
      userId,
      currentPassword,
      newPassword,
      metadata,
      currentSessionId,
    );
  }
}
