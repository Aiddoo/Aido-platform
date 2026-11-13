import { TodoSeriesOwnerPort } from "#api/modules/planning/todo-series/application/ports/todo-series-owner.port";
import type { SeriesOwnerActivity } from "#api/modules/planning/todo-series/domain/series-dormancy.domain-service";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

/** 저장한 규칙을 메모리에 두고 복원해 돌려주는 Fake. 잠금은 흉내 내지 않는다. */
export class StubTodoSeriesOwner extends TodoSeriesOwnerPort {
  /** 비워 두면 소유자가 방금 활동한 것으로 읽는다. */
  activity: SeriesOwnerActivity | null = null;
  readonly exemptUserIds = new Set<string>();
  /** 정지·탈퇴 대기 계정 */
  readonly suspendedUserIds = new Set<string>();
  exemptionChecks = 0;
  async findOperatingOwners(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>> {
    return new Map(
      userIds
        .map((userId) => userId.value)
        .filter((userId) => !this.suspendedUserIds.has(userId))
        .map((userId) => [
          userId,
          this.activity ?? {
            lastActiveAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
            signedUpAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
            timezone: "UTC",
          },
        ]),
    );
  }
  async isExemptFromDormancy(userId: UserId): Promise<boolean> {
    this.exemptionChecks += 1;
    return this.exemptUserIds.has(userId.value);
  }
}
