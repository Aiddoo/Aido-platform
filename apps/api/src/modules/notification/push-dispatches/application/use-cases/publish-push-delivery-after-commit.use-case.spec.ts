import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import { PushDispatchLogEvent } from "../push-dispatches.log-events.js";
import { PublishPushDeliveryAfterCommitUseCase } from "./publish-push-delivery-after-commit.use-case.js";
import type {
  PublishPushDeliveryOutboxInput,
  PublishPushDeliveryOutboxUseCase,
} from "./publish-push-delivery-outbox.use-case.js";

class RecordingPublishOutbox implements Pick<PublishPushDeliveryOutboxUseCase, "execute"> {
  readonly inputs: PublishPushDeliveryOutboxInput[] = [];
  result: () => Promise<number> = async () => 1;

  execute(input: PublishPushDeliveryOutboxInput): Promise<number> {
    this.inputs.push(input);
    return this.result();
  }
}

// 실제 timer로 바로 놓아주도록 2초 대신 1ms를 쓴다
const SHORT_FAST_PATH_TIMEOUT_MS = 1;

function createAfterCommitPublisher() {
  const afterCommit = new RecordingAfterCommitRegistry();
  const publishOutbox = new RecordingPublishOutbox();
  const logger = new SilentLogger();
  const publisher = new PublishPushDeliveryAfterCommitUseCase({
    afterCommit,
    publishOutbox,
    logger,
    fastPathTimeoutMs: SHORT_FAST_PATH_TIMEOUT_MS,
  });
  return { afterCommit, publishOutbox, logger, publisher };
}

describe("PublishPushDeliveryAfterCommitUseCase — commit 이후 fast path", () => {
  it("등록 시점의 dispatch ID 복사본만 commit 이후 발행한다", async () => {
    // Given
    const { afterCommit, publishOutbox, publisher } = createAfterCommitPublisher();
    const dispatchIds = [61, 62];

    // When
    publisher.execute({ dispatchIds });
    dispatchIds.splice(0, dispatchIds.length, 999);
    await afterCommit.runAll();

    // Then
    expect(afterCommit.tasks).toHaveLength(1);
    expect(publishOutbox.inputs).toEqual([{ kind: "dispatches", dispatchIds: [61, 62] }]);
  });

  it("timeout은 commit 흐름만 놓아주고 이미 시작한 발행은 취소하지 않는다", async () => {
    // Given
    const { afterCommit, publishOutbox, logger, publisher } = createAfterCommitPublisher();
    let resolvePublication: ((publishedCount: number) => void) | undefined;
    let underlyingPublicationSettled = false;
    const underlyingPublication = new Promise<number>((resolve) => {
      resolvePublication = resolve;
    }).then((publishedCount) => {
      underlyingPublicationSettled = true;
      return publishedCount;
    });
    publishOutbox.result = () => underlyingPublication;
    publisher.execute({ dispatchIds: [71] });

    // When
    const fastPath = afterCommit.runAll();

    // Then
    await expect(fastPath).resolves.toBeUndefined();
    expect(underlyingPublicationSettled).toBe(false);
    expect(logger.messages).toContainEqual(
      expect.objectContaining({
        event: PushDispatchLogEvent.PUSH_DELIVERY_AFTER_COMMIT_FAST_PATH_UNSETTLED,
        dispatchCount: 1,
      }),
    );
    resolvePublication?.(1);
    await expect(underlyingPublication).resolves.toBe(1);
    expect(underlyingPublicationSettled).toBe(true);
  });

  it("발행할 dispatch가 없으면 after-commit task를 등록하지 않는다", () => {
    // Given
    const { afterCommit, publisher } = createAfterCommitPublisher();

    // When
    publisher.execute({ dispatchIds: [] });

    // Then
    expect(afterCommit.tasks).toEqual([]);
  });
});
