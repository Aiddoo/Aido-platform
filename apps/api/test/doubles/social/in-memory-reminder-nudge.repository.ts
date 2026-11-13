import { ReminderNudgeRepositoryPort } from "#api/modules/social/reminder-nudges/application/ports/reminder-nudge.repository.port";
import { ReminderNudgeId } from "#api/modules/social/reminder-nudges/domain/reminder-nudge-id.vo";
import { ReminderNudge } from "#api/modules/social/reminder-nudges/domain/reminder-nudge.aggregate";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 저장 사본을 두어 save 없이 만든 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(reminder: ReminderNudge): ReminderNudge {
  return ReminderNudge.reconstitute(reminder.toPrimitives());
}

// Drizzle 저장소와 같게 생성 시각·id 내림차순의 첫 행을 마지막으로 본다
function compareLatestFirst(left: ReminderNudge, right: ReminderNudge): number {
  return (
    Temporal.Instant.compare(right.createdAt, left.createdAt) || right.id.value - left.id.value
  );
}

export class InMemoryReminderNudgeRepository extends ReminderNudgeRepositoryPort {
  readonly #reminders = new Map<number, ReminderNudge>();
  #sequence = 0;

  constructor(reminders: readonly ReminderNudge[] = []) {
    super();
    for (const reminder of reminders) {
      this.#reminders.set(reminder.id.value, copyOf(reminder));
    }
    this.#sequence = Math.max(0, ...this.#reminders.keys());
  }

  get size(): number {
    return this.#reminders.size;
  }

  async nextId(): Promise<ReminderNudgeId> {
    this.#sequence += 1;
    return ReminderNudgeId.reconstitute(this.#sequence);
  }

  async findLastSentTo(senderId: UserId, receiverId: UserId): Promise<ReminderNudge | null> {
    const [last] = [...this.#reminders.values()]
      .filter(
        (reminder) => reminder.senderId.equals(senderId) && reminder.receiverId.equals(receiverId),
      )
      .toSorted(compareLatestFirst);
    return last == null ? null : copyOf(last);
  }

  async save(reminder: ReminderNudge): Promise<void> {
    this.#reminders.set(reminder.id.value, copyOf(reminder));
  }
}
