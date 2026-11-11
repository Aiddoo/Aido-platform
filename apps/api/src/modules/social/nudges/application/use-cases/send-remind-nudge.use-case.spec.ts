import { ErrorCode } from "@aido/api/errors";

import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { RecordingNudgeNotifier } from "#test/doubles/social/recording-nudge-notifier";
import { StubFollowReader } from "#test/doubles/social/stub-follow-reader";
import {
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
  NUDGE_FIXTURE_TODAY,
} from "#test/fixtures/social/nudge.fixture";
import { createReminderNudgeFixture } from "#test/fixtures/social/reminder-nudge.fixture";

import { NudgeLockKeys } from "../nudges.lock-keys.js";
import {
  type SendRemindNudgeDependencies,
  SendRemindNudgeUseCase,
} from "./send-remind-nudge.use-case.js";

const SENDER_ID = UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(NUDGE_FIXTURE_RECEIVER_ID);
const COMMAND = {
  senderId: NUDGE_FIXTURE_SENDER_ID,
  receiverId: NUDGE_FIXTURE_RECEIVER_ID,
  timezone: "UTC",
};

// 잠금과 오늘 할 일 조회 순서를 남긴다
class OrderedLock extends MutationLockPort {
  readonly #events: string[];

  constructor(events: string[]) {
    super();
    this.#events = events;
  }

  async acquire(): Promise<void> {
    this.#events.push("lock");
  }
}

class OrderedNudgeRepository extends InMemoryNudgeRepository {
  readonly #events: string[];

  constructor(events: string[]) {
    super();
    this.#events = events;
  }

  override async countTodosOn(ownerId: UserId, date: Temporal.PlainDate): Promise<number> {
    this.#events.push("today");
    return super.countTodosOn(ownerId, date);
  }
}

function createFollowReader(): StubFollowReader {
  const followReader = new StubFollowReader();
  followReader.addMutual(NUDGE_FIXTURE_SENDER_ID, NUDGE_FIXTURE_RECEIVER_ID);
  followReader.setDisplayName(NUDGE_FIXTURE_SENDER_ID, "보낸이");
  return followReader;
}

function createSendRemindNudgeUseCase(overrides: Partial<SendRemindNudgeDependencies> = {}) {
  return new SendRemindNudgeUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    nudgeRepository: new InMemoryNudgeRepository(),
    followReader: createFollowReader(),
    notifier: new RecordingNudgeNotifier(),
    clock: new FixedClock(NUDGE_FIXTURE_NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("SendRemindNudgeUseCase — 할 일이 없는 친구에게 리마인드 콕", () => {
  it("오늘 할 일이 없으면 리마인드를 저장하고 할 일 없는 알림을 보낸다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    await nudgeRepository.addTodo(
      createNudgeTodoSeed({ startDate: NUDGE_FIXTURE_TODAY.subtract({ days: 1 }) }),
    );
    const mutationLock = new RecordingMutationLock();
    const notifier = new RecordingNudgeNotifier();
    const useCase = createSendRemindNudgeUseCase({ nudgeRepository, mutationLock, notifier });

    // When
    const reminder = await useCase.execute({ ...COMMAND, message: "작게 시작해요" });

    // Then
    expect(
      (await nudgeRepository.findLastReminderSentTo(SENDER_ID, RECEIVER_ID))?.toPrimitives(),
    ).toEqual({
      id: reminder.id.value,
      senderId: NUDGE_FIXTURE_SENDER_ID,
      receiverId: NUDGE_FIXTURE_RECEIVER_ID,
      message: "작게 시작해요",
      createdAt: NUDGE_FIXTURE_NOW,
    });
    expect(mutationLock.acquiredKeys).toEqual([
      [NudgeLockKeys.remindCooldown(SENDER_ID, RECEIVER_ID)],
    ]);
    expect(notifier.sent).toEqual([
      {
        nudgeId: reminder.id.value,
        senderId: NUDGE_FIXTURE_SENDER_ID,
        receiverId: NUDGE_FIXTURE_RECEIVER_ID,
        senderName: "보낸이",
        message: "작게 시작해요",
      },
    ]);
  });

  it.each([
    {
      receiverId: NUDGE_FIXTURE_SENDER_ID,
      expected: { errorCode: ErrorCode.NUDGE_1104 },
    },
    {
      receiverId: NUDGE_FIXTURE_OTHER_USER_ID,
      expected: {
        errorCode: ErrorCode.NUDGE_1103,
        details: { targetUserId: NUDGE_FIXTURE_OTHER_USER_ID },
      },
    },
  ])(
    "$expected.errorCode이면 리마인드와 알림을 남기지 않는다",
    async ({ receiverId, expected }) => {
      // Given
      const nudgeRepository = new InMemoryNudgeRepository();
      const notifier = new RecordingNudgeNotifier();
      const useCase = createSendRemindNudgeUseCase({ nudgeRepository, notifier });

      // When
      const result = useCase.execute({ ...COMMAND, receiverId });

      // Then
      await expect(result).rejects.toMatchObject(expected);
      expect(nudgeRepository.reminderCount).toBe(0);
      expect(notifier.sent).toEqual([]);
    },
  );

  it("친구에게 요청 시간대 오늘 할 일이 있으면 NUDGE_1107로 거절한다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    await nudgeRepository.addTodo(createNudgeTodoSeed({ startDate: NUDGE_FIXTURE_TODAY }));
    const useCase = createSendRemindNudgeUseCase({ nudgeRepository });

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NUDGE_1107,
      details: { receiverId: NUDGE_FIXTURE_RECEIVER_ID },
    });
    expect(nudgeRepository.reminderCount).toBe(0);
  });

  it("한 시간 안에 다시 보내면 남은 초와 함께 NUDGE_1108로 거절한다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    await nudgeRepository.saveReminder(
      createReminderNudgeFixture({ createdAt: NUDGE_FIXTURE_NOW.subtract({ seconds: 1 }) }),
    );
    const useCase = createSendRemindNudgeUseCase({ nudgeRepository });

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NUDGE_1108,
      details: { targetUserId: NUDGE_FIXTURE_RECEIVER_ID, remainingSeconds: 3599 },
    });
    expect(nudgeRepository.reminderCount).toBe(1);
  });

  it("친구 쿨다운 키를 오늘 할 일 조회 전에 잡는다", async () => {
    // Given
    const events: string[] = [];
    const useCase = createSendRemindNudgeUseCase({
      nudgeRepository: new OrderedNudgeRepository(events),
      mutationLock: new OrderedLock(events),
    });

    // When
    await useCase.execute(COMMAND);

    // Then
    expect(events).toEqual(["lock", "today"]);
  });
});
