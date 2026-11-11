import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  normalizeIanaTimezone,
  resolveWallClockTimezone,
} from "#api/shared/domain/time/time-zone-name";

import type { TodoOwnerTimezonePort } from "../ports/todo-owner-timezone.port.js";

interface TodoTimezoneResolverDependencies {
  readonly ownerTimezone: Pick<TodoOwnerTimezonePort, "findTimezone">;
}

/**
 * 할 일 쓰기가 벽시계를 해석할 시간대를 정한다. 요청 → 저장값 → 기본값 순서이고 규칙은 여기 하나다.
 * 앱은 늘 헤더를 보내므로 DB를 읽는 일은 헤더가 없거나 잘못된 요청뿐이다.
 */
export class ResolveTodoTimezoneUseCase {
  readonly #dependencies: TodoTimezoneResolverDependencies;

  constructor(dependencies: TodoTimezoneResolverDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, requested: string | undefined): Promise<string> {
    const timezone = normalizeIanaTimezone(requested);
    if (timezone != null) {
      return timezone;
    }
    return resolveWallClockTimezone(
      await this.#dependencies.ownerTimezone.findTimezone(UserId.reconstitute(userId)),
    );
  }
}
