import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";

import { encodeCreate } from "#api/platform/database/database-records";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";

import type {
  PushDispatchStagingRepositoryPort,
  StagePushDispatchInput,
  StagedPushDispatch,
} from "../../../application/ports/delivery/push-dispatch-staging.repository.port.js";

@Injectable()
export class PrismaPushDispatchStagingRepository implements PushDispatchStagingRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
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
    if (inputs.length === 0) return [];

    const dispatches = await this.client.orm.public.PushDispatch.select("id", "notificationId")
      .createAll(inputs.map(toDispatchCreate))
      .then((rows) =>
        rows.map((row) => ({ dispatchId: row.id, notificationId: row.notificationId })),
      );
    if (dispatches.length !== inputs.length) {
      throw new Error(
        `Push dispatch staging returned partial rows: expected=${inputs.length}, actual=${dispatches.length}`,
      );
    }

    const inputByNotificationId = new Map(inputs.map((input) => [input.notificationId, input]));
    await this.client.orm.public.PushDispatchOutbox.createAndCount(
      dispatches.map((dispatch) => {
        const input = inputByNotificationId.get(dispatch.notificationId);
        if (!input) {
          throw new Error(
            `Push dispatch staging input missing: notificationId=${dispatch.notificationId}`,
          );
        }
        return toOutboxCreate(dispatch.dispatchId, input);
      }),
    );

    return dispatches;
  }
}

function toDispatchCreate(input: StagePushDispatchInput) {
  return encodeCreate("PushDispatch", {
    notificationId: input.notificationId,
    userId: input.userId,
    purpose: input.purpose,
    campaignKey: input.campaignKey ?? null,
    variantId: input.variantId ?? null,
    status: "PENDING",
  });
}

function toOutboxCreate(dispatchId: number, input: StagePushDispatchInput) {
  return encodeCreate("PushDispatchOutbox", {
    dispatchId,
    deliveryMode: input.deliveryMode,
    force: input.force,
  });
}
