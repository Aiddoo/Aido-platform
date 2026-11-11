import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDispatch, pushDispatchOutbox } from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import type {
  PushDispatchStagingRepositoryPort,
  StagePushDispatchInput,
  StagedPushDispatch,
} from "../../application/ports/push-dispatch-staging.repository.port.js";

@Injectable()
export class DrizzlePushDispatchStagingRepository implements PushDispatchStagingRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async stage(input: StagePushDispatchInput): Promise<StagedPushDispatch> {
    const [staged] = await this.stageMany([input]);
    if (!staged) {
      throw new Error(
        `Push dispatch staging returned no row: notificationId=${input.notificationId}`,
      );
    }
    return staged;
  }

  async stageMany(
    inputs: readonly StagePushDispatchInput[],
  ): Promise<readonly StagedPushDispatch[]> {
    if (inputs.length === 0) {
      return [];
    }

    const updatedAt = this.#clock.now();
    const dispatches = await this.#db
      .insert(pushDispatch)
      .values(
        inputs.map((input) => ({
          notificationId: input.notificationId,
          userId: input.userId,
          purpose: input.purpose,
          campaignKey: input.campaignKey ?? null,
          variantId: input.variantId ?? null,
          status: "PENDING" as const,
          updatedAt,
        })),
      )
      .returning({ dispatchId: pushDispatch.id, notificationId: pushDispatch.notificationId });
    if (dispatches.length !== inputs.length) {
      throw new Error(
        `Push dispatch staging returned partial rows: expected=${inputs.length}, actual=${dispatches.length}`,
      );
    }

    const inputByNotificationId = new Map(inputs.map((input) => [input.notificationId, input]));
    await this.#db.insert(pushDispatchOutbox).values(
      dispatches.map((dispatch) => {
        const input = inputByNotificationId.get(dispatch.notificationId);
        if (!input) {
          throw new Error(
            `Push dispatch staging input missing: notificationId=${dispatch.notificationId}`,
          );
        }
        return {
          dispatchId: dispatch.dispatchId,
          deliveryMode: input.deliveryMode,
          force: input.force,
          updatedAt,
        };
      }),
    );

    return dispatches;
  }
}
