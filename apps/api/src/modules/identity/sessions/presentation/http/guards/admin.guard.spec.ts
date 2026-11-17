import { ErrorCode } from "@aido/api/errors";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";

import { AdminGuard } from "./admin.guard.js";

function contextWithUser(role?: string) {
  const user =
    role == null
      ? undefined
      : { userId: "user-1", email: "user@test.com", sessionId: "session-1", role };
  return new ExecutionContextHost([{ user }, {}]);
}

describe("AdminGuard — 관리자 가드", () => {
  const guard = new AdminGuard();

  it("ADMIN 역할을 가진 사용자는 접근을 허용한다", () => {
    // Given
    const context = contextWithUser("ADMIN");

    // When
    const result = guard.canActivate(context);

    // Then
    expect(result).toBe(true);
  });

  it.each(["USER", "UNKNOWN_ROLE", ""])("역할이 '%s'이면 ADMIN_1401로 거부한다", (role) => {
    // Given
    const context = contextWithUser(role);

    // When
    const activation = () => guard.canActivate(context);

    // Then
    expect(activation).toThrow(expect.objectContaining({ errorCode: ErrorCode.ADMIN_1401 }));
  });

  it("사용자 정보가 없으면 AUTH_0101로 거부한다", () => {
    // Given
    const context = contextWithUser();

    // When
    const activation = () => guard.canActivate(context);

    // Then
    expect(activation).toThrow(expect.objectContaining({ errorCode: ErrorCode.AUTH_0101 }));
  });
});
