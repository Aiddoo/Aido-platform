import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import { FollowReader } from "#api/modules/social/social-friends.public";
import { type MutationLockPort } from "#api/shared/application/ports/index";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { todayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { Nudge } from "../../../domain/aggregates/nudges/nudge.aggregate.js";
import { type NudgeLimitReaderPort } from "../../ports/nudges/nudge-limit-reader.port.js";
import { type NudgeNotifierPort } from "../../ports/nudges/nudge-notifier.port.js";
import {
  type NudgeRepositoryPort,
  type NudgeWithRelations,
  type TargetTodoRecord,
} from "../../ports/nudges/nudge.repository.port.js";
import { SendNudge } from "./send-nudge.use-case.js";

const today = todayInTimezone("UTC");

const targetTodo: TargetTodoRecord = {
  ownerId: "r",
  visibility: "PUBLIC",
  startDate: today,
  endDate: null,
};

const createdNudge: NudgeWithRelations = {
  id: 1,
  senderId: "s",
  receiverId: "r",
  todoId: 10,
  message: "hi",
  readAt: null,
  createdAt: new Date(),
  sender: {
    id: "s",
    userTag: "SENDER12",
    profile: { name: "S", profileImage: null },
  },
  receiver: { id: "r", userTag: "RECEIVER", profile: null },
  todo: { id: 10, title: "할 일", completed: false },
};

describe("SendNudge", () => {
  let useCase: SendNudge;
  let repo: Mocked<NudgeRepositoryPort>;
  let notifier: Mocked<NudgeNotifierPort>;
  let limitReader: Mocked<NudgeLimitReaderPort>;
  let follow: Mocked<FollowReader>;
  let mutationLock: Mocked<MutationLockPort>;
  let uow: Mocked<UnitOfWorkPort>;

  beforeEach(async () => {
    const sendNudgeDependencies = mockDeep<ConstructorParameters<typeof SendNudge>[0]>({
      mutationLock: { acquire: vi.fn() },
    });
    const unit = new SendNudge(sendNudgeDependencies);
    useCase = unit;
    repo = sendNudgeDependencies.nudgeRepository;
    notifier = sendNudgeDependencies.notifier;
    limitReader = sendNudgeDependencies.limitReader;
    follow = sendNudgeDependencies.followReader;
    mutationLock = sendNudgeDependencies.mutationLock;
    uow = sendNudgeDependencies.unitOfWork;

    uow.run.mockImplementation((work) => work());
    follow.isMutualFriend.mockResolvedValue(true);
    repo.findTargetTodo.mockResolvedValue(targetTodo);
    limitReader.getDailyLimitInTx.mockResolvedValue(3);
    repo.countTodayNudges.mockResolvedValue(0);
    repo.countSentSince.mockResolvedValue(0);
    repo.findLastNudgeForTodo.mockResolvedValue(null);
    repo.createNudge.mockResolvedValue(createdNudge);
  });

  it("자기 자신이면 NUDGE_1104", async () => {
    await expect(
      useCase.execute({ senderId: "s", receiverId: "s", todoId: 10 }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("친구가 아니면 NUDGE_1103", async () => {
    follow.isMutualFriend.mockResolvedValue(false);
    await expect(
      useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("Todo가 없으면 TODO_0801", async () => {
    repo.findTargetTodo.mockResolvedValue(null);
    await expect(
      useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("수신자 소유가 아니면 TODO_0801", async () => {
    repo.findTargetTodo.mockResolvedValue({ ...targetTodo, ownerId: "other" });
    await expect(
      useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("비공개면 TODO_0801", async () => {
    repo.findTargetTodo.mockResolvedValue({
      ...targetTodo,
      visibility: "PRIVATE",
    });
    await expect(
      useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("일일 한도 초과면 NUDGE_1101", async () => {
    repo.countSentSince.mockResolvedValue(3);
    await expect(
      useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("성공 시 콕 찌르기 생성 + 알림 enqueue", async () => {
    const result = await useCase.execute({
      senderId: "s",
      receiverId: "r",
      todoId: 10,
      message: "hi",
    });
    expect(result.id).toBe(1);
    expect(notifier.notifyNudgeSent).toHaveBeenCalledWith(
      expect.objectContaining({
        nudgeId: 1,
        senderId: "s",
        receiverId: "r",
        todoId: 10,
        todoTitle: "할 일",
      }),
    );
  });

  it("동일 Todo 쿨다운 중이면 NUDGE_1102", async () => {
    repo.findLastNudgeForTodo.mockResolvedValue(
      Nudge.reconstitute({
        id: 9,
        senderId: "s",
        receiverId: "r",
        todoId: 10,
        message: null,
        readAt: null,
        replyKind: null,
        repliedAt: null,
        replyUpdatedAt: null,
        thankedAt: null,
        createdAt: new Date(),
      }),
    );
    await expect(
      useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }),
    ).rejects.toBeInstanceOf(ApplicationException);
  });

  it("무제한(null)이면 한도 체크를 통과한다", async () => {
    limitReader.getDailyLimitInTx.mockResolvedValue(null);
    repo.countTodayNudges.mockResolvedValue(999);
    const result = await useCase.execute({
      senderId: "s",
      receiverId: "r",
      todoId: 10,
    });
    expect(result.id).toBe(1);
  });

  it("같은 시각 기준의 일일·Todo 쿨다운 키를 모든 guarded read 전에 UoW 안에서 잠근다", async () => {
    // Given - KST 자정 직전 시작하고 lock 대기 중 다음 날로 넘어가는 상황
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T14:59:59.900Z"));
    const events: string[] = [];
    mutationLock.acquire.mockImplementation(async () => {
      events.push("lock");
      vi.setSystemTime(new Date("2026-07-26T15:00:00.100Z"));
    });
    repo.findTargetTodo.mockImplementation(async () => {
      events.push("target-read");
      // 고정 시각(2026-07-26 KST)과 같은 날의 할 일이어야 isActiveOn을 통과한다.
      // 모듈 상단 targetTodo는 실행 시점의 실제 오늘이라 고정 시각과 어긋난다.
      return { ...targetTodo, startDate: new Date("2026-07-26T00:00:00.000Z") };
    });
    limitReader.getDailyLimitInTx.mockImplementation(async () => {
      events.push("limit");
      return 3;
    });
    repo.countSentSince.mockImplementation(async () => {
      events.push("daily-count");
      return 0;
    });
    repo.findLastNudgeForTodo.mockImplementation(async () => {
      events.push("cooldown-read");
      return null;
    });

    // When
    await useCase.execute({ senderId: "s", receiverId: "r", todoId: 10 }, "Asia/Seoul");

    // Then - lock key와 quota 시작점 모두 7/26 KST 기준이고 lock이 먼저임
    expect(mutationLock.acquire).toHaveBeenCalledWith([
      "mutation:v1:nudge:daily:s:2026-07-26",
      "mutation:v1:nudge:cooldown:s:10",
    ]);
    expect(repo.countSentSince).toHaveBeenCalledWith(
      "s",
      new Date("2026-07-25T15:00:00.000Z"),
      new Date("2026-07-26T15:00:00.000Z"),
    );
    expect(repo.createNudge).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAt: new Date("2026-07-26T14:59:59.900Z"),
      }),
    );
    expect(events).toEqual(["lock", "target-read", "limit", "daily-count", "cooldown-read"]);
    vi.useRealTimers();
  });
});
