import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { PushDeviceLogEvent } from "../../application/push-devices.log-events.js";
import { DeactivateStalePushTokensUseCase } from "../../application/use-cases/deactivate-stale-push-tokens.use-case.js";
import { STALE_PUSH_TOKEN_PRUNE_QUEUE } from "./stale-push-token-prune.queue.js";

@Injectable()
export class StalePushTokenPruneProcessor implements OnModuleInit {
  readonly #logger = new Logger(StalePushTokenPruneProcessor.name);

  readonly #deactivateStalePushTokens: Pick<DeactivateStalePushTokensUseCase, "execute">;
  readonly #jobQueue: JobQueuePort;

  constructor(
    @Inject(DeactivateStalePushTokensUseCase)
    deactivateStalePushTokens: Pick<DeactivateStalePushTokensUseCase, "execute">,
    jobQueue: JobQueuePort,
  ) {
    this.#deactivateStalePushTokens = deactivateStalePushTokens;
    this.#jobQueue = jobQueue;
  }

  async onModuleInit(): Promise<void> {
    await this.#jobQueue.work(STALE_PUSH_TOKEN_PRUNE_QUEUE, async () => this.process());
  }

  async process(): Promise<void> {
    try {
      await this.#deactivateStalePushTokens.execute();
    } catch (error) {
      this.#logger.error({
        event: PushDeviceLogEvent.STALE_PUSH_TOKEN_PRUNE_JOB_FAILED,
        errorType: toErrorType(error),
      });
      throw error;
    }
  }
}
