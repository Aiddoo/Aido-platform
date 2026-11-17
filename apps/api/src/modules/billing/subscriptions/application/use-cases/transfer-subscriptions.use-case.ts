import { sortBy, uniq } from "es-toolkit";

import type { ProjectPremiumAccessUseCase } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import {
  providerEventIdOf,
  type SubscriptionTransferredEvent,
} from "../../domain/store-subscription.event.js";
import { SubscriptionEventReceipt } from "../../domain/subscription-event-receipt.entity.js";
import type { SubscriptionEventReceiptRepositoryPort } from "../ports/subscription-event-receipt.repository.port.js";
import type { SubscriptionUserReaderPort } from "../ports/subscription-user.reader.port.js";
import type { SubscriptionRepositoryPort } from "../ports/subscription.repository.port.js";
import type { SubscriptionEventOutcomeReadModel } from "../read-models/subscription-event-outcome.read-model.js";
import {
  premiumAccessSummaryOf,
  type SubscriptionEventPayloadReadModel,
  transferEventPayload,
} from "../read-models/subscription-event-payload.read-model.js";
import type { SubscriptionUserReadModel } from "../read-models/subscription-user.read-model.js";
import {
  subscriptionUserNotFound,
  subscriptionWebhookLockContended,
} from "../subscriptions.errors.js";
import { SubscriptionLockKeys } from "../subscriptions.lock-keys.js";

export type TransferSubscriptionsCommand = SubscriptionTransferredEvent;

export interface TransferSubscriptionsDependencies {
  readonly subscriptionRepository: Pick<SubscriptionRepositoryPort, "takeOverChains">;
  readonly subscriptionUserReader: Pick<
    SubscriptionUserReaderPort,
    "findFirstByAppUserIds" | "listByAppUserIds"
  >;
  readonly receiptRepository: SubscriptionEventReceiptRepositoryPort;
  readonly userLock: Pick<UserMutationLockPort, "lockById">;
  readonly mutationLock: Pick<MutationLockPort, "tryAcquire">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly projectPremiumAccess: Pick<ProjectPremiumAccessUseCase, "execute">;
  readonly clock: ClockPort;
}

/**
 * 이전: 넘겨받은 사용자에게 넘겨준 사용자의 체인 행을 옮기고 둘 다 다시 계산한다. 이전 이벤트에는 체인 ID가
 * 없어 넘겨준 사용자의 행 전체를 옮기고, 같은 체인의 이벤트가 다시 그 사용자로 오면 transferTo가 되돌린다.
 * 행이 없으면(탈퇴로 지워짐) 다음 갱신이 체인을 이어 받는다.
 */
export class TransferSubscriptionsUseCase {
  readonly #dependencies: TransferSubscriptionsDependencies;

  constructor(dependencies: TransferSubscriptionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(event: TransferSubscriptionsCommand): Promise<SubscriptionEventOutcomeReadModel> {
    const { subscriptionUserReader, unitOfWork } = this.#dependencies;
    const receiverAppUserIds = uniq(event.receivers);
    const receiverAppUserId = receiverAppUserIds[0] ?? "";
    const receiver = await subscriptionUserReader.findFirstByAppUserIds(receiverAppUserIds);
    if (receiver == null) {
      throw subscriptionUserNotFound(receiverAppUserId);
    }
    const previousOwners = (
      await subscriptionUserReader.listByAppUserIds(event.transferredFrom)
    ).filter((owner) => !owner.id.equals(receiver.id));
    const payload = await unitOfWork.run(async () => {
      await this.#lockWebhook(receiverAppUserId);
      await this.#lockUsers(receiver, previousOwners, receiverAppUserId);
      if (!(await this.#claimReceipt(event))) {
        return null;
      }
      return this.#takeOver({ event, receiver, previousOwners, receiverAppUserId });
    });
    if (payload == null) {
      return { status: "duplicate", userId: receiver.id };
    }
    return {
      status: "applied",
      userId: receiver.id,
      affectedUserIds: [receiver.id, ...previousOwners.map((owner) => owner.id)],
      payload,
    };
  }

  // 같은 앱 사용자의 웹훅은 기다리지 않고 429로 돌려 공급자가 다시 보내게 한다. 잠금은 트랜잭션이 끝나면 풀린다
  async #lockWebhook(appUserId: string): Promise<void> {
    const keys = [SubscriptionLockKeys.webhook(appUserId)];
    if (!(await this.#dependencies.mutationLock.tryAcquire(keys))) {
      throw subscriptionWebhookLockContended(appUserId);
    }
  }

  // 넘겨준·넘겨받은 사용자를 id 순으로 잠가 반대 방향 이전과 교착하지 않는다
  async #lockUsers(
    receiver: SubscriptionUserReadModel,
    previousOwners: readonly SubscriptionUserReadModel[],
    receiverAppUserId: string,
  ): Promise<void> {
    for (const user of sortBy([receiver, ...previousOwners], [(user) => user.id.value])) {
      const isLocked = await this.#dependencies.userLock.lockById(user.id);
      if (!isLocked && user.id.equals(receiver.id)) {
        throw subscriptionUserNotFound(receiverAppUserId);
      }
    }
  }

  // 처리 원장은 업무 변경과 함께 커밋한다. 실패한 트랜잭션은 다시 처리할 수 있다
  async #claimReceipt(event: SubscriptionTransferredEvent): Promise<boolean> {
    const eventId = providerEventIdOf(event);
    if (eventId == null) {
      return true;
    }
    return this.#dependencies.receiptRepository.claim(
      SubscriptionEventReceipt.create({
        provider: event.provider,
        eventId,
        eventType: event.providerEventType,
        environment: event.environment,
        now: this.#dependencies.clock.now(),
      }),
    );
  }

  // 옮겨 받은 스토어 행과 보상 기간을 함께 보고 다시 계산해 보상 기간이 구독을 덮지 않게 한다
  async #takeOver(params: {
    readonly event: SubscriptionTransferredEvent;
    readonly receiver: SubscriptionUserReadModel;
    readonly previousOwners: readonly SubscriptionUserReadModel[];
    readonly receiverAppUserId: string;
  }): Promise<SubscriptionEventPayloadReadModel> {
    const { subscriptionRepository, projectPremiumAccess, clock } = this.#dependencies;
    const { event, receiver, previousOwners, receiverAppUserId } = params;
    const now = clock.now();
    for (const owner of previousOwners) {
      await subscriptionRepository.takeOverChains(owner.id, receiver.id, now);
    }
    const { access } = await projectPremiumAccess.execute({ userId: receiver.id, now });
    for (const owner of previousOwners) {
      await projectPremiumAccess.execute({ userId: owner.id, now });
    }
    return {
      ...transferEventPayload(receiver, event, receiverAppUserId),
      premium: premiumAccessSummaryOf(access),
    };
  }
}
