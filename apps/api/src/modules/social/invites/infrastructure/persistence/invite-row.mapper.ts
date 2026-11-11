import type { invite as inviteTable } from "#api/platform/database/schema/index";

import { Invite } from "../../domain/invite.aggregate.js";

export type InviteRow = Pick<
  typeof inviteTable.$inferSelect,
  "id" | "inviterId" | "code" | "status" | "createdAt" | "revokedAt"
>;

export const INVITE_COLUMNS = {
  id: true,
  inviterId: true,
  code: true,
  status: true,
  createdAt: true,
  revokedAt: true,
} as const;

export function toInvite(row: InviteRow): Invite {
  return Invite.reconstitute(row);
}

export function toInviteRow(invite: Invite): InviteRow {
  return invite.toPrimitives();
}
