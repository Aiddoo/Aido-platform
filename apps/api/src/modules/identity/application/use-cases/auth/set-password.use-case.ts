import type { PasswordWorkflow } from "../../workflows/auth/password.workflow.js";

interface SetPasswordDependencies {
  readonly workflow: PasswordWorkflow;
}

export class SetPassword {
  readonly #dependencies: SetPasswordDependencies;

  constructor(dependencies: SetPasswordDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    userId: Parameters<PasswordWorkflow["setPassword"]>[0],
    code: Parameters<PasswordWorkflow["setPassword"]>[1],
    newPassword: Parameters<PasswordWorkflow["setPassword"]>[2],
    metadata?: Parameters<PasswordWorkflow["setPassword"]>[3],
  ): ReturnType<PasswordWorkflow["setPassword"]> {
    return this.#dependencies.workflow.setPassword(userId, code, newPassword, metadata);
  }
}
