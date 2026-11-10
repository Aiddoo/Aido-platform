import type { CreateNotificationData } from "#api/modules/notification/inbox/application/ports/notification-draft.port";
import type { InboxNotification } from "#api/modules/notification/inbox/application/read-models/inbox-notification.read-model";
import type { PublishNotificationUseCase } from "#api/modules/notification/push/application/use-cases/publish-notification.use-case";

type PublishMode = "publish" | "publishWithDeduplication" | "publishBatch";

interface PublishedNotification {
  readonly mode: PublishMode;
  readonly data: CreateNotificationData;
}

// 발행한 알림을 경로(단건·중복 방지·배치)와 함께 남긴다. failWith를 두면 발행이 그 오류로 실패한다
export class RecordingNotificationPublisher implements Pick<
  PublishNotificationUseCase,
  PublishMode
> {
  readonly published: PublishedNotification[] = [];
  failWith: Error | null = null;

  async publish(data: CreateNotificationData): Promise<InboxNotification | null> {
    this.#record("publish", [data]);
    return null;
  }

  async publishWithDeduplication(data: CreateNotificationData): Promise<InboxNotification | null> {
    this.#record("publishWithDeduplication", [data]);
    return null;
  }

  async publishBatch(items: CreateNotificationData[]): Promise<{ count: number }> {
    this.#record("publishBatch", items);
    return { count: items.length };
  }

  #record(mode: PublishMode, items: readonly CreateNotificationData[]): void {
    if (this.failWith != null) {
      throw this.failWith;
    }
    this.published.push(...items.map((data) => ({ mode, data })));
  }
}
