import type { NotificationHistoryReaderPort } from "#api/modules/notification/notifications/application/ports/notification-history.reader.port";
import type {
  ListAlreadyNotifiedUserIdsQuery,
  ListNudgeSuggestedFriendsQuery,
  ListWinbackStagesSinceQuery,
} from "#api/modules/notification/notifications/application/ports/notification-history.reader.port";
import type { NotificationType } from "#api/modules/notification/shared/domain/notification-type.constants";

function keyOf(type: NotificationType, notificationDate: Temporal.PlainDate): string {
  return `${type}:${notificationDate.toString()}`;
}

interface SentWinbackStage {
  readonly userId: string;
  readonly stage: string;
  readonly createdAt: Temporal.Instant;
}

interface SentNudgeSuggestion {
  readonly userId: string;
  readonly friendId: string;
  readonly notificationDate: Temporal.PlainDate;
}

// 알림 타입별로 이미 받은 사용자를 두고 물어본 조회를 남긴다. 날짜를 주지 않으면 모든 날에 받은 것으로 본다
export class StubNotificationHistoryReader implements Pick<
  NotificationHistoryReaderPort,
  "listAlreadyNotifiedUserIds" | "listNudgeSuggestedFriends" | "listWinbackStagesSince"
> {
  readonly queries: ListAlreadyNotifiedUserIdsQuery[] = [];
  readonly winbackStageQueries: ListWinbackStagesSinceQuery[] = [];
  readonly nudgeSuggestionQueries: ListNudgeSuggestedFriendsQuery[] = [];
  readonly #notifiedByKey = new Map<string, Set<string>>();
  readonly #winbackStages: SentWinbackStage[] = [];
  readonly #nudgeSuggestions: SentNudgeSuggestion[] = [];

  notified(
    type: NotificationType,
    userIds: readonly string[],
    notificationDate?: Temporal.PlainDate,
  ): void {
    const key = notificationDate == null ? type : keyOf(type, notificationDate);
    const users = this.#notifiedByKey.get(key) ?? new Set<string>();
    for (const userId of userIds) {
      users.add(userId);
    }
    this.#notifiedByKey.set(key, users);
  }

  winbackSent(sent: SentWinbackStage): void {
    this.#winbackStages.push(sent);
  }

  nudgeSuggested(sent: SentNudgeSuggestion): void {
    this.#nudgeSuggestions.push(sent);
  }

  async listAlreadyNotifiedUserIds(query: ListAlreadyNotifiedUserIdsQuery): Promise<Set<string>> {
    this.queries.push({ ...query, userIds: [...query.userIds] });
    const notified = new Set([
      ...(this.#notifiedByKey.get(query.type) ?? []),
      ...(this.#notifiedByKey.get(keyOf(query.type, query.notificationDate)) ?? []),
    ]);
    return new Set(
      query.userIds.map((userId) => userId.value).filter((userId) => notified.has(userId)),
    );
  }

  async listWinbackStagesSince(
    query: ListWinbackStagesSinceQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    this.winbackStageQueries.push(query);
    return groupValues(
      query.recipients.flatMap(({ userId, since }) =>
        this.#winbackStages
          .filter(
            (sent) =>
              sent.userId === userId.value && Temporal.Instant.compare(sent.createdAt, since) >= 0,
          )
          .map((sent) => ({ userId: sent.userId, value: sent.stage })),
      ),
    );
  }

  async listNudgeSuggestedFriends(
    query: ListNudgeSuggestedFriendsQuery,
  ): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
    this.nudgeSuggestionQueries.push(query);
    return groupValues(
      this.#nudgeSuggestions
        .filter(
          (sent) =>
            query.userIds.some((userId) => userId.value === sent.userId) &&
            Temporal.PlainDate.compare(query.start, sent.notificationDate) <= 0 &&
            Temporal.PlainDate.compare(sent.notificationDate, query.end) < 0,
        )
        .map((sent) => ({ userId: sent.userId, value: sent.friendId })),
    );
  }
}

function groupValues(
  rows: readonly { readonly userId: string; readonly value: string }[],
): ReadonlyMap<string, ReadonlySet<string>> {
  const valuesByUserId = new Map<string, Set<string>>();
  for (const { userId, value } of rows) {
    valuesByUserId.set(userId, (valuesByUserId.get(userId) ?? new Set<string>()).add(value));
  }
  return valuesByUserId;
}
