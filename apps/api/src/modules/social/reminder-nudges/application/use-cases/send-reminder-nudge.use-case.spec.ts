import { ErrorCode } from "@aido/api/errors";

import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { InMemoryReminderNudgeRepository } from "#test/doubles/social/in-memory-reminder-nudge.repository";
import { InMemoryReminderTargetReader } from "#test/doubles/social/in-memory-reminder-target.reader";
import { RecordingReminderNudgeNotifier } from "#test/doubles/social/recording-reminder-nudge-notifier";
import { StubMutualFriendReader } from "#test/doubles/social/stub-mutual-friend-reader";
import {
  createReminderNudgeFixture,
  createReminderTargetTodoSeed,
  REMINDER_NUDGE_FIXTURE_NOW,
  REMINDER_NUDGE_FIXTURE_OTHER_USER_ID,
  REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
  REMINDER_NUDGE_FIXTURE_SENDER_ID,
  REMINDER_NUDGE_FIXTURE_TODAY,
} from "#test/fixtures/social/reminder-nudge.fixture";

import { ReminderNudgeLockKeys } from "../reminder-nudges.lock-keys.js";
import {
  type SendReminderNudgeDependencies,
  SendReminderNudgeUseCase,
} from "./send-reminder-nudge.use-case.js";

const SENDER_ID = UserId.reconstitute(REMINDER_NUDGE_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(REMINDER_NUDGE_FIXTURE_RECEIVER_ID);
const COMMAND = {
  senderId: REMINDER_NUDGE_FIXTURE_SENDER_ID,
  receiverId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
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

class OrderedTargetReader extends InMemoryReminderTargetReader {
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

function createMutualFriendReader(): StubMutualFriendReader {
  const mutualFriendReader = new StubMutualFriendReader();
  mutualFriendReader.addMutual(
    REMINDER_NUDGE_FIXTURE_SENDER_ID,
    REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
  );
  mutualFriendReader.setDisplayName(REMINDER_NUDGE_FIXTURE_SENDER_ID, "보낸이");
  return mutualFriendReader;
}

function createSendReminderNudgeUseCase(overrides: Partial<SendReminderNudgeDependencies> = {}) {
  return new SendReminderNudgeUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    reminderNudgeRepository: new InMemoryReminderNudgeRepository(),
    targetReader: new InMemoryReminderTargetReader(),
    mutualFriendReader: createMutualFriendReader(),
    notifier: new RecordingReminderNudgeNotifier(),
    clock: new FixedClock(REMINDER_NUDGE_FIXTURE_NOW),
    logger: new SilentLogger(),
    ...overrides,
  });
}

describe("SendReminderNudgeUseCase", () => {
  it("오늘 할 일이 없으면 리마인드를 저장하고 할 일 없는 콕 알림을 같은 트랜잭션에서 넣는다", async () => {
    // Given
    const reminderNudgeRepository = new InMemoryReminderNudgeRepository();
    const targetReader = new InMemoryReminderTargetReader();
    await targetReader.addTodo(
      createReminderTargetTodoSeed({
        startDate: REMINDER_NUDGE_FIXTURE_TODAY.subtract({ days: 1 }),
      }),
    );
    const mutationLock = new RecordingMutationLock();
    const notifier = new RecordingReminderNudgeNotifier();
    const useCase = createSendReminderNudgeUseCase({
      reminderNudgeRepository,
      targetReader,
      mutationLock,
      notifier,
    });

    // When
    const reminder = await useCase.execute({ ...COMMAND, message: "작게 시작해요" });

    // Then
    expect(
      (await reminderNudgeRepository.findLastSentTo(SENDER_ID, RECEIVER_ID))?.toPrimitives(),
    ).toEqual({
      id: reminder.id.value,
      senderId: REMINDER_NUDGE_FIXTURE_SENDER_ID,
      receiverId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
      message: "작게 시작해요",
      createdAt: REMINDER_NUDGE_FIXTURE_NOW,
    });
    expect(mutationLock.acquiredKeys).toEqual([
      [ReminderNudgeLockKeys.cooldown(SENDER_ID, RECEIVER_ID)],
    ]);
    expect(notifier.sent).toEqual([
      {
        nudgeId: reminder.id.value,
        senderId: REMINDER_NUDGE_FIXTURE_SENDER_ID,
        receiverId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
        senderName: "보낸이",
        message: "작게 시작해요",
      },
    ]);
  });

  it.each([
    {
      receiverId: REMINDER_NUDGE_FIXTURE_SENDER_ID,
      expected: { errorCode: ErrorCode.NUDGE_1104 },
    },
    {
      receiverId: REMINDER_NUDGE_FIXTURE_OTHER_USER_ID,
      expected: {
        errorCode: ErrorCode.NUDGE_1103,
        details: { targetUserId: REMINDER_NUDGE_FIXTURE_OTHER_USER_ID },
      },
    },
  ])(
    "$expected.errorCode이면 리마인드와 알림을 남기지 않는다",
    async ({ receiverId, expected }) => {
      // Given
      const reminderNudgeRepository = new InMemoryReminderNudgeRepository();
      const notifier = new RecordingReminderNudgeNotifier();
      const useCase = createSendReminderNudgeUseCase({ reminderNudgeRepository, notifier });

      // When
      const result = useCase.execute({ ...COMMAND, receiverId });

      // Then
      await expect(result).rejects.toMatchObject(expected);
      expect(reminderNudgeRepository.size).toBe(0);
      expect(notifier.sent).toEqual([]);
    },
  );

  it("친구에게 요청 시간대 오늘 할 일이 있으면 NUDGE_1107로 거절한다", async () => {
    // Given
    const reminderNudgeRepository = new InMemoryReminderNudgeRepository();
    const targetReader = new InMemoryReminderTargetReader();
    await targetReader.addTodo(
      createReminderTargetTodoSeed({ startDate: REMINDER_NUDGE_FIXTURE_TODAY }),
    );
    const useCase = createSendReminderNudgeUseCase({ reminderNudgeRepository, targetReader });

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NUDGE_1107,
      details: { receiverId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID },
    });
    expect(reminderNudgeRepository.size).toBe(0);
  });

  it("한 시간 안에 다시 보내면 남은 초와 함께 NUDGE_1108로 거절한다", async () => {
    // Given
    const reminderNudgeRepository = new InMemoryReminderNudgeRepository([
      createReminderNudgeFixture({
        createdAt: REMINDER_NUDGE_FIXTURE_NOW.subtract({ seconds: 1 }),
      }),
    ]);
    const useCase = createSendReminderNudgeUseCase({ reminderNudgeRepository });

    // When
    const result = useCase.execute(COMMAND);

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.NUDGE_1108,
      details: { targetUserId: REMINDER_NUDGE_FIXTURE_RECEIVER_ID, remainingSeconds: 3599 },
    });
    expect(reminderNudgeRepository.size).toBe(1);
  });

  it("친구 쿨다운 키를 오늘 할 일 조회 전에 잡는다", async () => {
    // Given
    const events: string[] = [];
    const useCase = createSendReminderNudgeUseCase({
      targetReader: new OrderedTargetReader(events),
      mutationLock: new OrderedLock(events),
    });

    // When
    await useCase.execute(COMMAND);

    // Then
    expect(events).toEqual(["lock", "today"]);
  });
});
