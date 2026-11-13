import { ErrorCode } from "@aido/api/errors";

import { InMemoryNudgeReader } from "#test/doubles/social/in-memory-nudge.reader";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";
import { StubMutualFriendReader } from "#test/doubles/social/stub-mutual-friend-reader";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_RECEIVER_ID,
  type NudgeTodoSeed,
} from "#test/fixtures/social/nudge.fixture";

import {
  type GetNudgeThanksPreviewDependencies,
  GetNudgeThanksPreviewUseCase,
} from "./get-nudge-thanks-preview.use-case.js";

const FRIEND_IDS = ["friend-a", "friend-b", "friend-c"];
const FIRST_THANKED_AT = NUDGE_FIXTURE_NOW.add({ hours: 1 });
const LAST_THANKED_AT = NUDGE_FIXTURE_NOW.add({ hours: 2 });

async function seedCompletedTodo(
  nudgeRepository: InMemoryNudgeRepository,
  todo: Partial<NudgeTodoSeed> = {},
): Promise<number> {
  return nudgeRepository.addTodo(createNudgeTodoSeed({ completed: true, ...todo }));
}

function createUseCase(
  nudgeRepository: InMemoryNudgeRepository,
  overrides: Partial<GetNudgeThanksPreviewDependencies> = {},
) {
  const mutualFriendReader = new StubMutualFriendReader();
  for (const friendId of FRIEND_IDS) {
    mutualFriendReader.addMutual(friendId, NUDGE_FIXTURE_RECEIVER_ID);
  }
  return new GetNudgeThanksPreviewUseCase({
    nudgeReader: new InMemoryNudgeReader(nudgeRepository),
    interactionConfig: { isEnabled: true },
    mutualFriendReader,
    ...overrides,
  });
}

describe("GetNudgeThanksPreviewUseCase — 감사 받을 친구 미리보기", () => {
  it("아직 감사하지 않은 친구와 이미 감사한 친구 수·마지막 감사 시각을 준다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository);
    await nudgeRepository.save(
      createNudgeFixture({ id: 1, senderId: "friend-a", todoId, thankedAt: FIRST_THANKED_AT }),
    );
    await nudgeRepository.save(
      createNudgeFixture({ id: 2, senderId: "friend-b", todoId, thankedAt: LAST_THANKED_AT }),
    );
    await nudgeRepository.save(createNudgeFixture({ id: 3, senderId: "friend-c", todoId }));

    // When
    const preview = await createUseCase(nudgeRepository).execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      limit: 20,
    });

    // Then
    expect(preview).toEqual({
      todoId,
      throughNudgeId: 3,
      recipients: [{ id: "friend-c", userTag: "friend-c", name: null, profileImage: null }],
      pagination: { totalRecipients: 1, nextCursor: null, hasNext: false },
      thankedRecipientCount: 2,
      lastThankedAt: LAST_THANKED_AT,
    });
  });

  it("받은 콕이 없으면 빈 대상과 0명·null 시각을 준다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository);

    // When
    const preview = await createUseCase(nudgeRepository).execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      limit: 20,
    });

    // Then
    expect(preview).toEqual({
      todoId,
      throughNudgeId: null,
      recipients: [],
      pagination: { totalRecipients: 0, nextCursor: null, hasNext: false },
      thankedRecipientCount: 0,
      lastThankedAt: null,
    });
  });

  it("limit을 주면 첫 미리보기 경계까지 커서로 나눠 주고, 옛 앱처럼 limit 없이 부르면 전부 준다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository);
    for (const [index, senderId] of FRIEND_IDS.entries()) {
      await nudgeRepository.save(createNudgeFixture({ id: index + 1, senderId, todoId }));
    }
    const useCase = createUseCase(nudgeRepository);
    const query = { userId: NUDGE_FIXTURE_RECEIVER_ID, todoId };

    // When
    const firstPage = await useCase.execute({ ...query, limit: 2 });
    const secondPage = await useCase.execute({
      ...query,
      limit: 2,
      cursor: firstPage.pagination?.nextCursor ?? undefined,
      throughNudgeId: firstPage.throughNudgeId ?? undefined,
    });
    const legacy = await useCase.execute(query);

    // Then
    expect(firstPage.recipients.map((user) => user.id)).toEqual(["friend-c", "friend-b"]);
    expect(firstPage.pagination).toEqual({ totalRecipients: 3, nextCursor: 2, hasNext: true });
    expect(secondPage.recipients.map((user) => user.id)).toEqual(["friend-a"]);
    expect(secondPage.pagination).toEqual({ totalRecipients: 3, nextCursor: null, hasNext: false });
    expect(legacy.recipients).toHaveLength(3);
    expect(legacy.pagination).toBeNull();
  });

  it("완료 저장보다 먼저 도착한 조회는 받은 콕·전한 감사가 있어도 거절하지 않고 빈 미리보기를 준다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository, { completed: false });
    await nudgeRepository.save(
      createNudgeFixture({ id: 1, senderId: "friend-a", todoId, thankedAt: FIRST_THANKED_AT }),
    );
    await nudgeRepository.save(createNudgeFixture({ id: 2, senderId: "friend-b", todoId }));

    // When
    const preview = await createUseCase(nudgeRepository).execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      limit: 20,
    });

    // Then
    expect(preview).toEqual({
      todoId,
      throughNudgeId: null,
      recipients: [],
      pagination: { totalRecipients: 0, nextCursor: null, hasNext: false },
      thankedRecipientCount: 0,
      lastThankedAt: null,
    });
  });

  it("비공개 할 일은 대상 없이 감사 요약만 준다", async () => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository, { visibility: "PRIVATE" });
    await nudgeRepository.save(createNudgeFixture({ id: 1, senderId: "friend-a", todoId }));

    // When
    const preview = await createUseCase(nudgeRepository).execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      limit: 20,
    });

    // Then
    expect(preview).toMatchObject({
      throughNudgeId: 1,
      recipients: [],
      pagination: { totalRecipients: 0, nextCursor: null, hasNext: false },
    });
  });

  it.each([
    {
      name: "기능이 꺼짐",
      isEnabled: false,
      todo: {},
      throughNudgeId: undefined,
      code: ErrorCode.NUDGE_1111,
    },
    {
      name: "내 할 일이 아님",
      isEnabled: true,
      todo: { ownerId: "friend-a" },
      throughNudgeId: undefined,
      code: ErrorCode.TODO_0801,
    },
    {
      name: "다른 할 일의 경계 콕",
      isEnabled: true,
      todo: {},
      throughNudgeId: 99,
      code: ErrorCode.NUDGE_1105,
    },
  ])("$name이면 $code로 거절한다", async ({ isEnabled, todo, throughNudgeId, code }) => {
    // Given
    const nudgeRepository = new InMemoryNudgeRepository();
    const todoId = await seedCompletedTodo(nudgeRepository, todo);
    const otherTodoId = await seedCompletedTodo(nudgeRepository);
    await nudgeRepository.save(
      createNudgeFixture({ id: 99, senderId: "friend-a", todoId: otherTodoId }),
    );
    const useCase = createUseCase(nudgeRepository, { interactionConfig: { isEnabled } });

    // When
    const result = useCase.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      todoId,
      limit: 20,
      throughNudgeId,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: code });
  });
});
