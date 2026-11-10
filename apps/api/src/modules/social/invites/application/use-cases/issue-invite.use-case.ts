import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { Invite } from "../../domain/invite.aggregate.js";
import { INVITE_CODE_MAX_ATTEMPTS } from "../../domain/invites.constants.js";
import { inviteCodeRetriesExhausted } from "../invites.errors.js";
import type { InviteCodeGeneratorPort } from "../ports/invite-code-generator.port.js";
import type { InviteRepositoryPort } from "../ports/invite.repository.port.js";

export interface IssueInviteCommand {
  readonly inviterId: UserId;
  readonly now: Temporal.Instant;
}

export interface IssueInviteDependencies {
  readonly inviteRepository: Pick<InviteRepositoryPort, "nextId" | "add">;
  readonly codeGenerator: Pick<InviteCodeGeneratorPort, "generate">;
}

/**
 * 새 코드로 ACTIVE 초대를 발급한다. 코드가 겹치면 SAVEPOINT 없이 새 코드로 다시 시도한다.
 * 호출자가 초대 잠금과 UoW를 잡는다.
 */
export class IssueInviteUseCase {
  readonly #dependencies: IssueInviteDependencies;

  constructor(dependencies: IssueInviteDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: IssueInviteCommand): Promise<Invite> {
    const { inviteRepository, codeGenerator } = this.#dependencies;
    const id = await inviteRepository.nextId();
    for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
      const invite = Invite.create({
        id,
        inviterId: command.inviterId,
        code: codeGenerator.generate(),
        now: command.now,
      });
      if (await inviteRepository.add(invite)) {
        return invite;
      }
    }
    throw inviteCodeRetriesExhausted(INVITE_CODE_MAX_ATTEMPTS);
  }
}
