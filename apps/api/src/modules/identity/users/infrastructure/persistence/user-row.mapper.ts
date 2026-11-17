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
