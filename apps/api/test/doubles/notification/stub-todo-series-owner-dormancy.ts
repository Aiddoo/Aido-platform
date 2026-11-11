import { TodoSeriesOwnerDormancyPort } from "#api/modules/notification/reminders/application/ports/todo-series-owner-dormancy.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// 정해 둔 휴면 시작일을 모든 사용자에게 답하고 물어본 사용자를 남긴다
export class StubTodoSeriesOwnerDormancy extends TodoSeriesOwnerDormancyPort {
  dormantSince: string | null = null;
  readonly askedUserIds: string[] = [];

  async findDormantSince(user: UserId): Promise<string | null> {
    const userId = user.value;
    this.askedUserIds.push(userId);
    return this.dormantSince;
  }
}
