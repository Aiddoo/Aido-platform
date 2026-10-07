import type { Mocked } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { BroadcastNotification } from "./broadcast-notification.use-case.js";

/** 주어진 배치들을 순서대로 흘려보내는 async 이터러블 스텁 */
async function* streamOf(batches: string[][]): AsyncIterable<string[]> {
  for (const batch of batches) {
    yield batch;
  }
}

describe("BroadcastNotification — 브로드캐스트", () => {
  let useCase: BroadcastNotification;
  let userDirectory: Mocked<
    ConstructorParameters<typeof BroadcastNotification>[0]["userDirectory"]
  >;
  let notifier: Mocked<ConstructorParameters<typeof BroadcastNotification>[0]["notifier"]>;

  beforeEach(async () => {
    const broadcastNotificationDependencies = mockDeep<
      ConstructorParameters<typeof BroadcastNotification>[0]
    >({});
    const unit = new BroadcastNotification(broadcastNotificationDependencies);

    useCase = unit;
    userDirectory = broadcastNotificationDependencies.userDirectory;
    notifier = broadcastNotificationDependencies.notifier;
  });

  it("여러 배치를 스트리밍하며 배치마다 발송하고 결과를 집계한다", async () => {
    // Given - 2개 배치(3+2명)가 스트리밍되고 각각 발송이 성공할 때
    userDirectory.streamTargetUserIds.mockReturnValue(
      streamOf([
        ["u1", "u2", "u3"],
        ["u4", "u5"],
      ]),
    );
    notifier.sendBatch.mockResolvedValueOnce({ count: 3 }).mockResolvedValueOnce({ count: 2 });

    // When - 브로드캐스트를 실행하면
    const result = await useCase.execute({
      title: "제목",
      body: "내용",
      targetFilter: "ALL",
      action: undefined,
      force: false,
    });

    // Then - 배치별로 발송하고 총계를 반환한다
    expect(notifier.sendBatch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      successCount: 5,
      failCount: 0,
      totalTargets: 5,
    });
  });

  it("외부 URL 액션이 있으면 externalUrl 메타데이터를 부여한다", async () => {
    // Given - 브라우저 액션(url 포함)이 주어졌을 때
    userDirectory.streamTargetUserIds.mockReturnValue(streamOf([["u1"]]));
    notifier.sendBatch.mockResolvedValue({ count: 1 });

    // When - 브로드캐스트를 실행하면
    await useCase.execute({
      title: "제목",
      body: "내용",
      targetFilter: "ALL",
      action: {
        type: "BROWSER",
        url: "https://aido.kr/event",
      },
      force: false,
    });

    // Then - 발송 메시지에 externalUrl 메타데이터가 포함된다
    const messages = notifier.sendBatch.mock.calls[0]?.[0];
    expect(messages?.[0]).toMatchObject({
      type: "ADMIN_BROADCAST",
      metadata: { externalUrl: "https://aido.kr/event" },
    });
  });

  it("force 입력은 발송 메시지에 그대로 전파된다", async () => {
    // Given - force 브로드캐스트 요청
    userDirectory.streamTargetUserIds.mockReturnValue(streamOf([["u1"]]));
    notifier.sendBatch.mockResolvedValue({ count: 1 });

    // When - force로 브로드캐스트를 실행하면
    await useCase.execute({
      title: "제목",
      body: "내용",
      targetFilter: "WITH_PUSH_TOKEN",
      action: undefined,
      force: true,
    });

    // Then - 모든 발송 메시지에 force가 포함된다
    const messages = notifier.sendBatch.mock.calls[0]?.[0];
    expect(messages?.[0]).toMatchObject({ force: true });
  });

  it("대상이 한 명도 없으면 ADMIN_1402를 던진다", async () => {
    // Given - 대상 스트림이 비어 있을 때
    userDirectory.streamTargetUserIds.mockReturnValue(streamOf([]));

    // When/Then - 대상 없음 예외로 실패한다
    await expect(
      useCase.execute({
        title: "제목",
        body: "내용",
        targetFilter: "ALL",
        action: undefined,
        force: false,
      }),
    ).rejects.toMatchObject({ errorCode: "ADMIN_1402" });
    expect(notifier.sendBatch).not.toHaveBeenCalled();
  });
  it("대상 스트림을 기다리는 동안 호출자가 action을 바꿔도 접수한 URL을 발송한다", async () => {
    // Given - 실제 UseCase가 대상 조회를 기다리며 변경 가능한 호출자 입력을 보관한다
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const action: { type: "BROWSER"; url: string } = {
      type: "BROWSER",
      url: "https://example.test/original",
    };
    userDirectory.streamTargetUserIds.mockReturnValue(
      (async function* () {
        entered.resolve();
        await release.promise;
        yield ["synthetic-user"];
      })(),
    );
    notifier.sendBatch.mockResolvedValue({ count: 1 });
    const running = useCase.execute({
      title: "안내",
      body: "변경 전 안내",
      targetFilter: "ALL",
      action,
      force: false,
    });
    try {
      // When - 대상 조회가 진행 중일 때 외부 입력이 변경된다
      await entered.promise;
      action.url = "https://example.test/changed";
      release.resolve();
      await expect(running).resolves.toEqual({ successCount: 1, failCount: 0, totalTargets: 1 });
      // Then - action과 metadata 모두 접수 시점의 URL을 사용한다
      expect(notifier.sendBatch.mock.calls[0]?.[0]?.[0]).toMatchObject({
        action: { type: "BROWSER", url: "https://example.test/original" },
        metadata: { externalUrl: "https://example.test/original" },
      });
    } finally {
      release.resolve();
      await running;
    }
  });
});
