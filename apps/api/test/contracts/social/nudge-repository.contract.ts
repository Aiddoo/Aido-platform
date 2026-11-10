import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { NudgeReaderPort } from "#api/modules/social/nudges/application/ports/nudge.reader.port";
import type { NudgeRepositoryPort } from "#api/modules/social/nudges/application/ports/nudge.repository.port";
import type { Nudge, NudgePrimitives } from "#api/modules/social/nudges/domain/nudge.aggregate";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
  NUDGE_FIXTURE_TODAY,
  type NudgeTodoSeed,
} from "#test/fixtures/social/nudge.fixture";
import { createReminderNudgeFixture } from "#test/fixtures/social/reminder-nudge.fixture";

type NudgeStore = NudgeRepositoryPort & NudgeReaderPort;

export interface NudgeRepositoryContractSubject {
  readonly repository: NudgeStore;
  // 콕 대상 할 일은 planning이 쓰는 행이라 저장소 밖에서 넣는다
  addTodo(seed: NudgeTodoSeed): Promise<number>;
}

const SENDER_ID = UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(NUDGE_FIXTURE_RECEIVER_ID);
const OTHER_USER_ID = UserId.reconstitute(NUDGE_FIXTURE_OTHER_USER_ID);
const LATER = NUDGE_FIXTURE_NOW.add({ minutes: 1 });

async function saveNudge(
  repository: NudgeStore,
  overrides: Partial<NudgePrimitives> & { readonly todoId: number },
): Promise<Nudge> {
  const nudge = createNudgeFixture({ id: (await repository.nextId()).value, ...overrides });
  await repository.save(nudge);
  return nudge;
}

function idsOf(items: readonly { readonly id: number }[]): number[] {
  return items.map((item) => item.id);
}

export function describeNudgeRepositoryContract(
  createSubject: () => Promise<NudgeRepositoryContractSubject>,
): void {
  describe("콕 저장소 계약", () => {
    it("nextId·nextReminderId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const { repository } = await createSubject();

      // When
      const nudgeIds = [await repository.nextId(), await repository.nextId()];
      const reminderIds = [await repository.nextReminderId(), await repository.nextReminderId()];

      // Then
      expect(nudgeIds[0]?.equals(nudgeIds[1] ?? nudgeIds[0])).toBe(false);
      expect(reminderIds[0]?.equals(reminderIds[1] ?? reminderIds[0])).toBe(false);
    });

    it("다시 저장하면 답장은 덮어쓰고 이미 저장된 읽음·감사 시각은 남긴다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed());
      const nudge = await saveNudge(repository, { todoId, message: "같이 해요" });
      const firstRead = createNudgeFixture({
        ...nudge.toPrimitives(),
        readAt: NUDGE_FIXTURE_NOW,
        thankedAt: NUDGE_FIXTURE_NOW,
      });
      await repository.save(firstRead);
      const replied = createNudgeFixture({
        ...nudge.toPrimitives(),
        readAt: LATER,
        replyKind: "LATER",
        repliedAt: LATER,
        replyUpdatedAt: LATER,
        thankedAt: LATER,
      });

      // When
      await repository.save(replied);
      const saved = await repository.findById(nudge.id);

      // Then
      expect(saved?.toPrimitives()).toEqual({
        ...replied.toPrimitives(),
        readAt: NUDGE_FIXTURE_NOW,
        thankedAt: NUDGE_FIXTURE_NOW,
      });
      expect(await repository.findById(await repository.nextId())).toBeNull();
    });

    it("할 일·친구별 마지막 콕은 생성 시각이 가장 늦은 것이다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed());
      const otherTodoId = await addTodo(createNudgeTodoSeed());
      await saveNudge(repository, { todoId, createdAt: NUDGE_FIXTURE_NOW });
      const latestForTodo = await saveNudge(repository, { todoId, createdAt: LATER });
      const latestToReceiver = await saveNudge(repository, {
        todoId: otherTodoId,
        createdAt: LATER.add({ minutes: 1 }),
      });

      // When
      const lastForTodo = await repository.findLastSentForTodo(
        SENDER_ID,
        TodoId.reconstitute(todoId),
      );
      const lastTo = await repository.findLastSentTo(SENDER_ID, RECEIVER_ID);
      const none = await repository.findLastSentTo(OTHER_USER_ID, RECEIVER_ID);

      // Then
      expect(lastForTodo?.id.value).toBe(latestForTodo.id.value);
      expect(lastTo?.id.value).toBe(latestToReceiver.id.value);
      expect(none).toBeNull();
    });

    it("보낸 수는 시작 시각을 포함하고 끝 시각을 빼며 그 사람이 보낸 콕만 센다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed());
      const startsAt = NUDGE_FIXTURE_NOW;
      const endsAt = NUDGE_FIXTURE_NOW.add({ hours: 24 });
      for (const createdAt of [
        startsAt.subtract({ milliseconds: 1 }),
        startsAt,
        endsAt.subtract({ milliseconds: 1 }),
        endsAt,
      ]) {
        await saveNudge(repository, { todoId, createdAt });
      }
      await saveNudge(repository, {
        todoId,
        senderId: NUDGE_FIXTURE_OTHER_USER_ID,
        createdAt: startsAt,
      });

      // When
      const used = await repository.countSentBetween(SENDER_ID, { startsAt, endsAt });

      // Then
      expect(used).toBe(2);
    });

    it("대상 할 일은 소유자·제목·공개 범위·날짜를 읽고 없으면 null이다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const seed = createNudgeTodoSeed({
        visibility: "PRIVATE",
        startDate: NUDGE_FIXTURE_TODAY.subtract({ days: 1 }),
        endDate: NUDGE_FIXTURE_TODAY.add({ days: 1 }),
      });
      const todoId = await addTodo(seed);

      // When
      const target = await repository.findTargetTodo(TodoId.reconstitute(todoId));
      const missing = await repository.findTargetTodo(TodoId.reconstitute(todoId + 1_000));

      // Then
      expect(target?.value).toEqual({
        ownerId: seed.ownerId,
        title: seed.title,
        visibility: seed.visibility,
        startDate: seed.startDate,
        endDate: seed.endDate,
      });
      expect(missing).toBeNull();
    });

    it("답장·감사 할 일은 소유자에게만 준다(잠금 조회와 일반 조회가 같다)", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed({ completed: true }));
      const expected = {
        id: todoId,
        ownerId: NUDGE_FIXTURE_RECEIVER_ID,
        title: "운동하기",
        completed: true,
        visibility: "PUBLIC",
      };

      // When
      const locked = await repository.lockInteractionTodo(TodoId.reconstitute(todoId), RECEIVER_ID);
      const found = await repository.findInteractionTodo(TodoId.reconstitute(todoId), RECEIVER_ID);
      const foreign = await repository.findInteractionTodo(TodoId.reconstitute(todoId), SENDER_ID);

      // Then
      expect({ locked, found, foreign }).toEqual({
        locked: expected,
        found: expected,
        foreign: null,
      });
    });

    it("그 날짜의 할 일 수는 기간 할 일과 그날 시작한 하루 할 일을 센다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const today = NUDGE_FIXTURE_TODAY;
      await addTodo(createNudgeTodoSeed({ startDate: today }));
      await addTodo(
        createNudgeTodoSeed({
          startDate: today.subtract({ days: 2 }),
          endDate: today.add({ days: 1 }),
        }),
      );
      await addTodo(createNudgeTodoSeed({ startDate: today.subtract({ days: 1 }) }));
      await addTodo(
        createNudgeTodoSeed({
          startDate: today.subtract({ days: 3 }),
          endDate: today.subtract({ days: 1 }),
        }),
      );
      await addTodo(
        createNudgeTodoSeed({ ownerId: NUDGE_FIXTURE_OTHER_USER_ID, startDate: today }),
      );

      // When
      const count = await repository.countTodosOn(RECEIVER_ID, today);
      const tomorrow = await repository.countTodosOn(RECEIVER_ID, today.add({ days: 1 }));

      // Then
      expect({ count, tomorrow }).toEqual({ count: 2, tomorrow: 1 });
    });

    it("리마인드 콕은 그 친구에게 가장 늦게 보낸 것을 찾는다", async () => {
      // Given
      const { repository } = await createSubject();
      const older = createReminderNudgeFixture({ id: (await repository.nextReminderId()).value });
      const latest = createReminderNudgeFixture({
        id: (await repository.nextReminderId()).value,
        message: "할 일 만들자",
        createdAt: LATER,
      });
      await repository.saveReminder(older);
      await repository.saveReminder(latest);

      // When
      const last = await repository.findLastReminderSentTo(SENDER_ID, RECEIVER_ID);
      const none = await repository.findLastReminderSentTo(RECEIVER_ID, SENDER_ID);

      // Then
      expect(last?.toPrimitives()).toEqual(latest.toPrimitives());
      expect(none).toBeNull();
    });

    it("받은·보낸 콕은 생성 시각·id 내림차순으로 after 콕 뒤부터 주고 개수를 센다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed());
      const oldest = await saveNudge(repository, { todoId, createdAt: NUDGE_FIXTURE_NOW });
      const tiedOlder = await saveNudge(repository, { todoId, createdAt: LATER, readAt: LATER });
      const tiedNewer = await saveNudge(repository, { todoId, createdAt: LATER });
      const otherTodoId = await addTodo(createNudgeTodoSeed({ ownerId: NUDGE_FIXTURE_SENDER_ID }));
      await saveNudge(repository, {
        todoId: otherTodoId,
        senderId: NUDGE_FIXTURE_RECEIVER_ID,
        receiverId: NUDGE_FIXTURE_SENDER_ID,
      });

      // When
      const firstPage = await repository.listReceived({
        userId: RECEIVER_ID,
        afterNudgeId: null,
        limit: 2,
      });
      const nextPage = await repository.listReceived({
        userId: RECEIVER_ID,
        afterNudgeId: tiedOlder.id,
        limit: 5,
      });
      const sent = await repository.listSent({ userId: SENDER_ID, afterNudgeId: null, limit: 5 });
      const afterMissing = await repository.listSent({
        userId: SENDER_ID,
        afterNudgeId: await repository.nextId(),
        limit: 5,
      });

      // Then
      expect(idsOf(firstPage)).toEqual([tiedNewer.id.value, tiedOlder.id.value]);
      expect(idsOf(nextPage)).toEqual([oldest.id.value]);
      expect(idsOf(sent)).toEqual([tiedNewer.id.value, tiedOlder.id.value, oldest.id.value]);
      expect(afterMissing).toEqual([]);
      expect(firstPage[0]).toMatchObject({
        sender: { id: NUDGE_FIXTURE_SENDER_ID },
        receiver: { id: NUDGE_FIXTURE_RECEIVER_ID },
        todo: {
          id: todoId,
          title: "운동하기",
          completed: false,
          ownerId: NUDGE_FIXTURE_RECEIVER_ID,
        },
      });
      expect({
        received: await repository.countReceived(RECEIVER_ID),
        unread: await repository.countUnreadReceived(RECEIVER_ID),
        sent: await repository.countSent(SENDER_ID),
      }).toEqual({ received: 3, unread: 2, sent: 3 });
    });

    it("주고받은 콕 하나는 보낸 사람·받은 사람에게만 보이고 목록은 방향별 id 내림차순이다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed());
      const first = await saveNudge(repository, { todoId });
      const second = await saveNudge(repository, {
        todoId,
        replyKind: "STARTING",
        repliedAt: LATER,
      });
      const third = await saveNudge(repository, { todoId });

      // When
      const asReceiver = await repository.findInteraction(second.id, RECEIVER_ID);
      const asSender = await repository.findInteraction(second.id, SENDER_ID);
      const asStranger = await repository.findInteraction(second.id, OTHER_USER_ID);
      const received = await repository.listInteractions({
        viewerId: RECEIVER_ID,
        direction: "received",
        afterNudgeId: third.id,
        limit: 5,
      });
      const sentByReceiver = await repository.listInteractions({
        viewerId: RECEIVER_ID,
        direction: "sent",
        afterNudgeId: null,
        limit: 5,
      });

      // Then
      expect(asReceiver).toMatchObject({
        id: second.id.value,
        replyKind: "STARTING",
        repliedAt: LATER,
      });
      expect(asSender?.id).toBe(second.id.value);
      expect(asStranger).toBeNull();
      expect(idsOf(received)).toEqual([second.id.value, first.id.value]);
      expect(sentByReceiver).toEqual([]);
    });

    it("감사 요약은 감사한 친구 수와 마지막 감사 시각, 마지막으로 받은 콕 id를 준다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed({ completed: true }));
      const emptyLast = await repository.findLastThankedAt(
        TodoId.reconstitute(todoId),
        RECEIVER_ID,
      );
      await saveNudge(repository, { todoId, thankedAt: NUDGE_FIXTURE_NOW });
      await saveNudge(repository, {
        todoId,
        senderId: NUDGE_FIXTURE_OTHER_USER_ID,
        thankedAt: LATER,
      });
      const lastReceived = await saveNudge(repository, { todoId });

      // When
      const thankedCount = await repository.countThankedRecipients(
        TodoId.reconstitute(todoId),
        RECEIVER_ID,
      );
      const lastThankedAt = await repository.findLastThankedAt(
        TodoId.reconstitute(todoId),
        RECEIVER_ID,
      );
      const lastReceivedId = await repository.findLastReceivedNudgeId(
        TodoId.reconstitute(todoId),
        RECEIVER_ID,
      );
      const noneReceived = await repository.findLastReceivedNudgeId(
        TodoId.reconstitute(todoId),
        SENDER_ID,
      );

      // Then
      expect(emptyLast).toBeNull();
      expect(thankedCount).toBe(2);
      expect(lastThankedAt).toEqual(LATER);
      expect(lastReceivedId?.value).toBe(lastReceived.id.value);
      expect(noneReceived).toBeNull();
    });

    it("감사 대상은 친구마다 throughNudgeId까지 받은 아직 감사하지 않은 가장 최근 콕 하나다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed({ completed: true }));
      await saveNudge(repository, { todoId });
      const senderLatest = await saveNudge(repository, { todoId });
      const otherNudge = await saveNudge(repository, {
        todoId,
        senderId: NUDGE_FIXTURE_OTHER_USER_ID,
      });
      await saveNudge(repository, { todoId, senderId: NUDGE_FIXTURE_OTHER_USER_ID });
      const query = {
        ownerId: RECEIVER_ID,
        todoId: TodoId.reconstitute(todoId),
        throughNudgeId: otherNudge.id,
        friendIds: [SENDER_ID, OTHER_USER_ID],
      };

      // When
      const candidates = await repository.listThanksCandidates(query);
      const firstPage = await repository.listThanksRecipients({
        ...query,
        afterNudgeId: null,
        limit: 1,
      });
      const nextPage = await repository.listThanksRecipients({
        ...query,
        afterNudgeId: otherNudge.id,
        limit: 1,
      });
      const total = await repository.countThanksRecipients(query);
      const notFriends = await repository.countThanksRecipients({ ...query, friendIds: [] });

      // Then
      expect(candidates.map((nudge) => nudge.id.value)).toEqual([
        otherNudge.id.value,
        senderLatest.id.value,
      ]);
      expect(firstPage).toMatchObject([
        { nudgeId: otherNudge.id.value, sender: { id: NUDGE_FIXTURE_OTHER_USER_ID } },
      ]);
      expect(nextPage).toMatchObject([
        { nudgeId: senderLatest.id.value, sender: { id: NUDGE_FIXTURE_SENDER_ID } },
      ]);
      expect({ total, notFriends }).toEqual({ total: 2, notFriends: 0 });
    });

    it("이미 감사한 친구와 비공개 할 일의 콕은 감사 대상이 아니다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed({ completed: true }));
      await saveNudge(repository, { todoId, thankedAt: NUDGE_FIXTURE_NOW });
      const unthanked = await saveNudge(repository, { todoId });
      const privateTodoId = await addTodo(
        createNudgeTodoSeed({ completed: true, visibility: "PRIVATE" }),
      );
      const privateNudge = await saveNudge(repository, { todoId: privateTodoId });
      const friendIds = [SENDER_ID];

      // When
      const thanked = await repository.listThanksCandidates({
        ownerId: RECEIVER_ID,
        todoId: TodoId.reconstitute(todoId),
        throughNudgeId: unthanked.id,
        friendIds,
      });
      const privateCandidates = await repository.listThanksCandidates({
        ownerId: RECEIVER_ID,
        todoId: TodoId.reconstitute(privateTodoId),
        throughNudgeId: privateNudge.id,
        friendIds,
      });

      // Then
      expect({ thanked, privateCandidates }).toEqual({ thanked: [], privateCandidates: [] });
    });

    it("감사 저장은 아직 감사하지 않은 콕에만 감사 시각을 남긴다", async () => {
      // Given
      const { repository, addTodo } = await createSubject();
      const todoId = await addTodo(createNudgeTodoSeed({ completed: true }));
      const fresh = await saveNudge(repository, { todoId, senderId: NUDGE_FIXTURE_OTHER_USER_ID });
      const stale = await saveNudge(repository, { todoId, thankedAt: NUDGE_FIXTURE_NOW });
      const freshThanked = createNudgeFixture({ ...fresh.toPrimitives(), thankedAt: LATER });
      const staleThanked = createNudgeFixture({ ...stale.toPrimitives(), thankedAt: LATER });

      // When
      await repository.saveThanks([freshThanked, staleThanked]);

      // Then
      expect((await repository.findById(fresh.id))?.thankedAt).toEqual(LATER);
      expect((await repository.findById(stale.id))?.thankedAt).toEqual(NUDGE_FIXTURE_NOW);
    });
  });
}
