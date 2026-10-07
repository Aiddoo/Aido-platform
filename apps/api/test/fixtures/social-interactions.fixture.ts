import type { CheerLimitReaderPort } from "#api/modules/social/application/ports/cheers/cheer-limit-reader.port";
import type { NudgeLimitReaderPort } from "#api/modules/social/application/ports/nudges/nudge-limit-reader.port";
import { createSocialFriendFixture } from "#test/fixtures/social-friends.fixture";
import { TodoFixture } from "#test/fixtures/todo.fixture";
import {
  StubCheerRepository,
  StubNudgeRepository,
  StubCheerNotifier,
  StubNudgeNotifier,
} from "#test/mocks/ports/social-interactions.stub";

export function createSocialInteractionFixture() {
  const fixture = createSocialFriendFixture();
  fixture.addUser("sender");
  fixture.addUser("receiver");
  fixture.addMutual("sender", "receiver");
  const cheerRepository = new StubCheerRepository(fixture.followRepository.users);
  const nudgeRepository = new StubNudgeRepository(fixture.followRepository.users);
  const cheerNotifier = new StubCheerNotifier();
  const nudgeNotifier = new StubNudgeNotifier();
  const cheerLimitReader: CheerLimitReaderPort = {
    getDailyLimitInTx: async (userId) =>
      (await fixture.entitlementReader.getFeatureLimitInTx(userId, "CHEER")).dailyLimit,
  };
  const nudgeLimitReader: NudgeLimitReaderPort = {
    getDailyLimitInTx: async (userId) =>
      (await fixture.entitlementReader.getFeatureLimitInTx(userId, "NUDGE")).dailyLimit,
  };
  const nudgeInteractionConfig = { isEnabled: true };
  function addTodo(
    input: {
      id?: number;
      userId?: string;
      visibility?: "PUBLIC" | "PRIVATE";
      completed?: boolean;
      startDate?: Date;
      endDate?: Date | null;
    } = {},
  ) {
    const todo = TodoFixture.create({
      id: input.id,
      userId: input.userId ?? "receiver",
      visibility: input.visibility ?? "PUBLIC",
      completed: input.completed ?? false,
      startDate: input.startDate ?? new Date("2026-07-26T00:00:00Z"),
      endDate: input.endDate === undefined ? null : input.endDate,
    });
    nudgeRepository.todos.set(todo.id, {
      ownerId: todo.userId,
      title: todo.title,
      visibility: todo.visibility,
      completed: todo.completed,
      startDate: new Date(todo.startDate),
      endDate: todo.endDate === null ? null : new Date(todo.endDate),
    });
    return todo;
  }
  return {
    ...fixture,
    followReader: fixture.reader,
    cheerRepository,
    nudgeRepository,
    cheerNotifier,
    nudgeNotifier,
    cheerLimitReader,
    nudgeLimitReader,
    nudgeInteractionConfig,
    addTodo,
  };
}
