import type { QueueOptions, UpdateQueueOptions } from "pg-boss";

import type { JobRetryPolicy } from "#api/shared/application/ports/job-queue.port";

interface QueueProvisioningClient {
  createQueue(name: string, options?: QueueOptions): Promise<void>;
  updateQueue(name: string, options: UpdateQueueOptions): Promise<void>;
}

// 프로세스마다 큐를 한 번만 만들고 정책을 한 번만 맞춰 enqueue마다 pg-boss 왕복이 생기지 않게 한다
export class PgBossQueueProvisioner {
  readonly #boss: QueueProvisioningClient;
  readonly #creations = new Map<string, Promise<void>>();
  readonly #policyApplications = new Map<string, Promise<void>>();

  constructor(boss: QueueProvisioningClient) {
    this.#boss = boss;
  }

  async ensure(queue: string, policy?: JobRetryPolicy): Promise<void> {
    const existing = this.#creations.get(queue);
    if (existing) {
      await existing;
    } else {
      const creation = this.#boss.createQueue(
        queue,
        policy ? toPgBossQueueOptions(policy) : undefined,
      );
      this.#creations.set(queue, creation);
      try {
        await creation;
      } catch (error) {
        this.#creations.delete(queue);
        throw error;
      }
    }

    if (policy) {
      await this.#applyPolicy(queue, policy);
    }
  }

  async #applyPolicy(queue: string, policy: JobRetryPolicy): Promise<void> {
    const policyKey = `${queue}:${JSON.stringify(policy)}`;
    const existing = this.#policyApplications.get(policyKey);
    if (existing) {
      await existing;
      return;
    }

    // createQueue는 기존 queue의 정책을 갱신하지 않는다. updateQueue를 함께 호출해
    // worker-first rolling 배포에서 이미 생성된 DLQ도 동일한 정책으로 수렴시킨다.
    const application = this.#boss.updateQueue(queue, toPgBossQueueOptions(policy));
    this.#policyApplications.set(policyKey, application);
    try {
      await application;
    } catch (error) {
      this.#policyApplications.delete(policyKey);
      throw error;
    }
  }
}

function toPgBossQueueOptions(policy: JobRetryPolicy): QueueOptions {
  return {
    retryLimit: policy.retryLimit,
    retryDelay: policy.retryDelaySeconds,
    retryBackoff: policy.retryBackoff,
    expireInSeconds: policy.expireInSeconds,
    retentionSeconds: policy.retentionSeconds,
    deleteAfterSeconds: policy.deleteAfterSeconds,
  };
}
