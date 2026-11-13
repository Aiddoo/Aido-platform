import { ErrorCode } from "@aido/api/errors";
import { CHEER_LIMITS } from "@aido/api/vocabulary";

import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryCheerRepository } from "#test/doubles/social/in-memory-cheer.repository";
import { PassThroughCountCache } from "#test/doubles/social/pass-through-count-cache";
import { RecordingCheerNotifier } from "#test/doubles/social/recording-cheer-notifier";
import { StubCheerLimitReader } from "#test/doubles/social/stub-cheer-limit-reader";
import { StubMutualFriendReader } from "#test/doubles/social/stub-mutual-friend-reader";
import {
  CHEER_FIXTURE_NOW,
  CHEER_FIXTURE_OTHER_USER_ID,
  CHEER_FIXTURE_RECEIVER_ID,
  CHEER_FIXTURE_SENDER_ID,
  createCheerFixture,
} from "#test/fixtures/social/cheer.fixture";

import { CheerLockKeys } from "../cheers.lock-keys.js";
import { type SendCheerDependencies, SendCheerUseCase } from "./send-cheer.use-case.js";

const SENDER_ID = UserId.reconstitute(CHEER_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(CHEER_FIXTURE_RECEIVER_ID);
const DAILY_LIMIT = 3;

// 잠금을 기다리는 동안 시계가 흐른 상황을 만든다
class ClockAdvancingLock extends MutationLockPort {
  readonly #clock: FixedClock;

  constructor(clock: FixedClock) {
    super();
    this.#clock = clock;
  }

  async acquire(): Promise<void> {
    this.#clock.advanceBy({ milliseconds: 200 });
  }
}

function createFollowReader(): StubMutualFriendReader {
  const mutualFriendReader = new StubMutualFriendReader();
  mutualFriendReader.addMutual(CHEER_FIXTURE_SENDER_ID, CHEER_FIXTURE_RECEIVER_ID);
  mutualFriendReader.setDisplayName(CHEER_FIXTURE_SENDER_ID, "보낸이");
  return mutualFriendReader;
}

function createSendCheerUseCase(overrides: Partial<SendCheerDependencies> = {}) {
  return new SendCheerUseCase({
    countCache: new PassThroughCountCache(),
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    cheerRepository: new InMemoryCheerRepository(),
    limitReader: new StubCheerLimitReader(DAILY_LIMIT),
    mutualFriendReader: createFollowReader(),
    notifier: new RecordingCheerNotifier(),
    clock: new FixedClock(CHEER_FIXTURE_NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

function sentToday(count: number): InMemoryCheerRepository {
  return new InMemoryCheerRepository(
    Array.from({ length: count }, (_, index) =>
      createCheerFixture({
        id: index + 1,
        receiverId: CHEER_FIXTURE_OTHER_USER_ID,
        createdAt: CHEER_FIXTURE_NOW.subtract({ minutes: index + 1 }),
      }),
    ),
  );
}

describe("SendCheerUseCase — 친구에게 응원 보내기", () => {
  it("친구에게 보낸 응원을 잠금 안에서 저장하고 표시 이름으로 알림을 보낸다", async () => {
    // Given
    const cheerRepository = new InMemoryCheerRepository();
    const mutationLock = new RecordingMutationLock();
    const notifier = new RecordingCheerNotifier();
    const useCase = createSendCheerUseCase({ cheerRepository, mutationLock, notifier });

    // When
    const cheer = await useCase.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      message: "응원해요",
      timezone: "UTC",
    });

    // Then
    expect((await cheerRepository.findById(cheer.id))?.toPrimitives()).toEqual({
      id: cheer.id.value,
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      message: "응원해요",
      readAt: null,
      createdAt: CHEER_FIXTURE_NOW,
    });
    expect(mutationLock.acquiredKeys).toEqual([
      [CheerLockKeys.dailyQuota(SENDER_ID), CheerLockKeys.cooldown(SENDER_ID, RECEIVER_ID)],
    ]);
    expect(notifier.sent).toEqual([
      {
        cheerId: cheer.id.value,
        senderId: CHEER_FIXTURE_SENDER_ID,
        receiverId: CHEER_FIXTURE_RECEIVER_ID,
        senderName: "보낸이",
        message: "응원해요",
      },
    ]);
  });

  it("메시지 없이 보내면 메시지 없는 응원과 알림을 만든다", async () => {
    // Given
    const notifier = new RecordingCheerNotifier();
    const useCase = createSendCheerUseCase({ notifier });

    // When
    const cheer = await useCase.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      timezone: "UTC",
    });

    // Then
    expect(cheer.message).toBeNull();
    expect(notifier.sent[0]?.message).toBeUndefined();
  });

  it.each([
    {
      name: "자기 자신",
      receiverId: CHEER_FIXTURE_SENDER_ID,
      expected: { errorCode: ErrorCode.CHEER_1204 },
    },
    {
      name: "친구가 아닌 사용자(메시지가 길어도)",
      receiverId: CHEER_FIXTURE_OTHER_USER_ID,
      expected: {
        errorCode: ErrorCode.CHEER_1203,
        details: { targetUserId: CHEER_FIXTURE_OTHER_USER_ID },
      },
    },
  ])("$name에게는 보내지 않고 저장·알림도 남기지 않는다", async ({ receiverId, expected }) => {
    // Given
    const cheerRepository = new InMemoryCheerRepository();
    const notifier = new RecordingCheerNotifier();
    const useCase = createSendCheerUseCase({ cheerRepository, notifier });

    // When
    const result = useCase.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId,
      message: "a".repeat(CHEER_LIMITS.MAX_MESSAGE_LENGTH + 1),
      timezone: "UTC",
    });

    // Then
    await expect(result).rejects.toMatchObject(expected);
    expect(cheerRepository.size).toBe(0);
    expect(notifier.sent).toEqual([]);
  });

  it("오늘 한도를 다 쓰면 쿨다운보다 먼저 CHEER_1201과 서버 계산 featureQuota로 거절한다", async () => {
    // Given
    const cheerRepository = new InMemoryCheerRepository(
      Array.from({ length: DAILY_LIMIT }, (_, index) =>
        createCheerFixture({
          id: index + 1,
          createdAt: CHEER_FIXTURE_NOW.subtract({ minutes: index + 1 }),
        }),
      ),
    );
    const notifier = new RecordingCheerNotifier();
    const useCase = createSendCheerUseCase({ cheerRepository, notifier });

    // When
    const result = useCase.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      timezone: "UTC",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.CHEER_1201,
      details: {
        charged: false,
        featureQuota: {
          feature: "CHEER",
          limit: DAILY_LIMIT,
          used: DAILY_LIMIT,
          remaining: 0,
          resetsAt: "2026-07-27T00:00:00.000Z",
        },
      },
    });
    expect(cheerRepository.size).toBe(DAILY_LIMIT);
    expect(notifier.sent).toEqual([]);
  });

  it("한도 오류의 resetsAt은 요청 시간대의 다음 자정이다", async () => {
    // Given
    const useCase = createSendCheerUseCase({ cheerRepository: sentToday(DAILY_LIMIT) });

    // When
    const result = useCase.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.CHEER_1201,
      details: { featureQuota: { resetsAt: "2026-07-26T15:00:00.000Z" } },
    });
  });

  it("무제한이어도 같은 친구에게 24시간 안에는 남은 초와 함께 CHEER_1202로 거절한다", async () => {
    // Given
    const cheerRepository = new InMemoryCheerRepository([
      createCheerFixture({ createdAt: CHEER_FIXTURE_NOW.subtract({ seconds: 1 }) }),
    ]);
    const useCase = createSendCheerUseCase({
      cheerRepository,
      limitReader: new StubCheerLimitReader(null),
    });

    // When
    const result = useCase.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      timezone: "UTC",
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.CHEER_1202,
      details: { targetUserId: CHEER_FIXTURE_RECEIVER_ID, remainingSeconds: 86_399 },
    });
    expect(cheerRepository.size).toBe(1);
  });

  it("잠금을 기다리다 서울 자정을 넘겨도 요청 시각의 하루로 세고 그 시각으로 저장한다", async () => {
    // Given
    const requestedAt = Temporal.Instant.from("2026-07-26T14:59:59.900Z");
    const clock = new FixedClock(requestedAt);
    const firstOfDay = createCheerFixture({
      receiverId: CHEER_FIXTURE_OTHER_USER_ID,
      createdAt: Temporal.Instant.from("2026-07-25T15:00:00Z"),
    });
    const blocked = createSendCheerUseCase({
      cheerRepository: new InMemoryCheerRepository([firstOfDay]),
      limitReader: new StubCheerLimitReader(1),
      mutationLock: new ClockAdvancingLock(clock),
      clock,
    });
    const allowedClock = new FixedClock(requestedAt);
    const allowed = createSendCheerUseCase({
      mutationLock: new ClockAdvancingLock(allowedClock),
      clock: allowedClock,
    });

    // When
    const blockedResult = blocked.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      timezone: "Asia/Seoul",
    });
    const cheer = await allowed.execute({
      senderId: CHEER_FIXTURE_SENDER_ID,
      receiverId: CHEER_FIXTURE_RECEIVER_ID,
      timezone: "Asia/Seoul",
    });

    // Then
    await expect(blockedResult).rejects.toMatchObject({
      errorCode: ErrorCode.CHEER_1201,
      details: { featureQuota: { used: 1, resetsAt: "2026-07-26T15:00:00.000Z" } },
    });
    expect(cheer.createdAt).toEqual(requestedAt);
  });
});
