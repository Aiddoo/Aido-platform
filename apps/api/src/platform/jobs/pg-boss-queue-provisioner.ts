import type { UpdateQueueOptions } from "pg-boss";

import type { JobRetryPolicy } from "#api/shared/application/ports/job-queue.port";

import type { PgBossQueueOptions } from "./pg-boss-client.js";

interface QueueProvisioningClient {
  createQueue(name: string, options?: PgBossQueueOptions): Promise<void>;
  updateQueue(name: string, options: UpdateQueueOptions): Promise<void>;
}

/** 큐에 맞출 정책. DLQ를 원래 큐 쪽에서 만들 때는 대기 경고 기준을 비워 DLQ 자신의 정의 값을 덮지 않는다 */
export interface PgBossQueueSettings {
  readonly retry: JobRetryPolicy;
  readonly backlogWarningSize?: number;
}

// 프로세스마다 큐를 한 번만 만들고 정책을 한 번만 맞춰 enqueue마다 pg-boss 왕복이 생기지 않게 한다
export class PgBossQueueProvisioner {
  readonly #boss: QueueProvisioningClient;
  readonly #creations = new Map<string, Promise<void>>();
  readonly #policyApplications = new Map<string, Promise<void>>();

  constructor(boss: QueueProvisioningClient) {
    this.#boss = boss;
  }

  async ensure(queue: string, settings?: PgBossQueueSettings): Promise<void> {
    const existing = this.#creations.get(queue);
    if (existing) {
      await existing;
    } else {
      const creation = this.#boss.createQueue(
        queue,
        settings ? toPgBossQueueOptions(settings) : undefined,
      );
      this.#creations.set(queue, creation);
      try {
        await creation;
      } catch (error) {
        this.#creations.delete(queue);
        throw error;
      }
    }

    if (settings) {
      await this.#applyPolicy(queue, settings);
    }
  }

  async #applyPolicy(queue: string, settings: PgBossQueueSettings): Promise<void> {
    const policyKey = `${queue}:${JSON.stringify(settings)}`;
    const existing = this.#policyApplications.get(policyKey);
    if (existing) {
      await existing;
      return;
    }

    // createQueue는 기존 queue의 정책을 갱신하지 않는다. updateQueue를 함께 호출해
    // worker-first rolling 배포에서 이미 생성된 DLQ도 동일한 정책으로 수렴시킨다.
    // updateQueue는 넘긴 칸만 바꾸므로 경고 기준이 빠진 호출은 기존 값을 그대로 둔다.
    const application = this.#boss.updateQueue(queue, toPgBossQueueOptions(settings));
    this.#policyApplications.set(policyKey, application);
    try {
      await application;
    } catch (error) {
      this.#policyApplications.delete(policyKey);
      throw error;
    }
  }
}

function toPgBossQueueOptions({
  retry,
  backlogWarningSize,
}: PgBossQueueSettings): PgBossQueueOptions {
  return {
    retryLimit: retry.retryLimit,
    retryDelay: retry.retryDelaySeconds,
    retryBackoff: retry.retryBackoff,
    expireInSeconds: retry.expireInSeconds,
    retentionSeconds: retry.retentionSeconds,
    deleteAfterSeconds: retry.deleteAfterSeconds,
    ...(backlogWarningSize != null && { warningQueueSize: backlogWarningSize }),
  };
}
