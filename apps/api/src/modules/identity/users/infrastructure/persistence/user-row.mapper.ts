import type { user as userTable } from "#api/platform/database/schema/index";

import { User } from "../../domain/user.aggregate.js";

type UserRow = Pick<
  typeof userTable.$inferSelect,
  | "id"
  | "email"
  | "userTag"
  | "role"
  | "status"
  | "emailVerifiedAt"
  | "subscriptionStatus"
  | "subscriptionExpiresAt"
  | "createdAt"
  | "deletedAt"
>;

export function toUser(row: UserRow): User {
  return User.reconstitute({
    id: row.id,
    email: row.email,
    userTag: row.userTag,
    role: row.role,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt,
    subscriptionStatus: row.subscriptionStatus,
    subscriptionExpiresAt: row.subscriptionExpiresAt,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
  });
}

// 새 사용자만 넣는다. 활동·사용량 칸은 DB 기본값이고 수정 시각은 저장한 시각이다
// 새 행은 만든 시각(User.create의 now) 하나로 createdAt·updatedAt을 함께 쓴다
export function toUserRow(identityUser: User): typeof userTable.$inferInsert {
  const primitives = identityUser.toPrimitives();
  return { ...primitives, updatedAt: primitives.createdAt };
}
