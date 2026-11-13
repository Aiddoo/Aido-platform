import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { InviterProgressReaderPort } from "../../application/ports/inviter-progress.reader.port.js";
import type { InviterProgressReadModel } from "../../application/read-models/inviter-progress.read-model.js";
import { SummarizeInviterProgressUseCase } from "../../application/use-cases/summarize-inviter-progress.use-case.js";

@Injectable()
export class InviterProgressReaderAdapter implements InviterProgressReaderPort {
  readonly #summarizeInviterProgress: SummarizeInviterProgressUseCase;

  constructor(summarizeInviterProgress: SummarizeInviterProgressUseCase) {
    this.#summarizeInviterProgress = summarizeInviterProgress;
  }

  readProgress(inviterId: UserId, now: Temporal.Instant): Promise<InviterProgressReadModel> {
    return this.#summarizeInviterProgress.execute({ inviterId, now });
  }
}
