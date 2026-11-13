import type { ReminderNudgeRepositoryPort } from "#api/modules/social/reminder-nudges/application/ports/reminder-nudge.repository.port";
import type { ReminderTargetReaderPort } from "#api/modules/social/reminder-nudges/application/ports/reminder-target.reader.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createReminderNudgeFixture,
  createReminderTargetTodoSeed,
  REMINDER_NUDGE_FIXTURE_NOW,
  REMINDER_NUDGE_FIXTURE_OTHER_USER_ID,
  REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
  REMINDER_NUDGE_FIXTURE_SENDER_ID,
  REMINDER_NUDGE_FIXTURE_TODAY,
  type ReminderTargetTodoSeed,
} from "#test/fixtures/social/reminder-nudge.fixture";

export interface ReminderNudgeRepositoryContractSubject {
  readonly repository: ReminderNudgeRepositoryPort;
  readonly targetReader: ReminderTargetReaderPort;
  // 받는 친구의 할 일은 planning이 쓰는 행이라 저장소 밖에서 넣는다
  addTodo(seed: ReminderTargetTodoSeed): Promise<void>;
}

const SENDER_ID = UserId.reconstitute(REMINDER_NUDGE_FIXTURE_SENDER_ID);
const RECEIVER_ID = UserId.reconstitute(REMINDER_NUDGE_FIXTURE_RECEIVER_ID);

export function describeReminderNudgeRepositoryContract(
  createSubject: () => Promise<ReminderNudgeRepositoryContractSubject>,
): void {
  describe("리마인드 콕 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const { repository } = await createSubject();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("그 친구에게 가장 늦게 보낸 리마인드를 찾고 다른 방향은 없다", async () => {
      // Given
      const { repository } = await createSubject();
      const older = createReminderNudgeFixture({ id: (await repository.nextId()).value });
      const latest = createReminderNudgeFixture({
        id: (await repository.nextId()).value,
        message: "할 일 만들자",
        createdAt: REMINDER_NUDGE_FIXTURE_NOW.add({ minutes: 1 }),
      });
      await repository.save(older);
      await repository.save(latest);

      // When
      const last = await repository.findLastSentTo(SENDER_ID, RECEIVER_ID);
      const none = await repository.findLastSentTo(RECEIVER_ID, SENDER_ID);

      // Then
      expect(last?.toPrimitives()).toEqual(latest.toPrimitives());
      expect(none).toBeNull();
    });

    it("그 날짜의 할 일 수는 기간 할 일과 그날 시작한 하루 할 일을 센다", async () => {
      // Given
      const { targetReader, addTodo } = await createSubject();
      const today = REMINDER_NUDGE_FIXTURE_TODAY;
      await addTodo(createReminderTargetTodoSeed({ startDate: today }));
      await addTodo(
        createReminderTargetTodoSeed({
          startDate: today.subtract({ days: 2 }),
          endDate: today.add({ days: 1 }),
        }),
      );
      await addTodo(createReminderTargetTodoSeed({ startDate: today.subtract({ days: 1 }) }));
      await addTodo(
        createReminderTargetTodoSeed({
          startDate: today.subtract({ days: 3 }),
          endDate: today.subtract({ days: 1 }),
        }),
      );
      await addTodo(
        createReminderTargetTodoSeed({
          ownerId: REMINDER_NUDGE_FIXTURE_OTHER_USER_ID,
          startDate: today,
        }),
      );

      // When
      const count = await targetReader.countTodosOn(RECEIVER_ID, today);
      const tomorrow = await targetReader.countTodosOn(RECEIVER_ID, today.add({ days: 1 }));

      // Then
      expect({ count, tomorrow }).toEqual({ count: 2, tomorrow: 1 });
    });
  });
}
