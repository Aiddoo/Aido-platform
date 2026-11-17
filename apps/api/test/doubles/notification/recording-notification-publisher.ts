import type { InboxNotificationReadModel } from "#api/modules/notification/notifications/application/read-models/inbox-notification.read-model";
import type { BatchNotificationOptions } from "#api/modules/notification/notifications/application/use-cases/persist-batch-notification.use-case";
import type { PublishDeduplicatedNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/publish-deduplicated-notification.use-case";
import type { PublishNotificationBatchUseCase } from "#api/modules/notification/notifications/application/use-cases/publish-notification-batch.use-case";
import type { PublishNotificationUseCase } from "#api/modules/notification/notifications/application/use-cases/publish-notification.use-case";
import type { CreateNotificationData } from "#api/modules/notification/shared/application/ports/notification-draft.port";

type PublishMode = "single" | "deduplicated" | "batch";

interface PublishedNotification {
  readonly mode: PublishMode;
  readonly data: CreateNotificationData;
}

// 세 발행 UseCase 자리에 끼우고 발행한 알림을 경로와 함께 한 목록에 남긴다. failWith를 두면 발행이 그 오류로 실패한다
export class RecordingNotificationPublisher {
  readonly published: PublishedNotification[] = [];
  readonly batchOptions: BatchNotificationOptions[] = [];
  failWith: Error | null = null;

  readonly single: Pick<PublishNotificationUseCase, "execute"> = {
    execute: (data) => this.publishSingle(data),
  };

  readonly deduplicated: Pick<PublishDeduplicatedNotificationUseCase, "execute"> = {
    execute: async (data) => {
      this.#record("deduplicated", [data]);
      return null;
    },
  };

  readonly batch: Pick<PublishNotificationBatchUseCase, "execute"> = {
    execute: (items, options) => this.publishBatch(items, options),
  };

  // 실패를 흉내 내는 spec이 단건·묶음 발행만 바꿔 끼운다
  async publishSingle(data: CreateNotificationData): Promise<InboxNotificationReadModel | null> {
    this.#record("single", [data]);
    return null;
  }

  async publishBatch(
    items: CreateNotificationData[],
    options: BatchNotificationOptions = {},
  ): Promise<{ count: number }> {
    this.#record("batch", items);
    this.batchOptions.push(options);
    return { count: items.length };
  }

  #record(mode: PublishMode, items: readonly CreateNotificationData[]): void {
    if (this.failWith != null) {
      throw this.failWith;
    }
    this.published.push(...items.map((data) => ({ mode, data })));
  }
}
