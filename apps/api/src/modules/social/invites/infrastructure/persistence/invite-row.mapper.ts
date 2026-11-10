import type { invite as inviteTable } from "#api/platform/database/schema/index";
import { instantFromDate, instantToDate } from "#api/shared/domain/time/instant";

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
  return Invite.reconstitute({
    ...row,
    createdAt: instantFromDate(row.createdAt),
    revokedAt: row.revokedAt == null ? null : instantFromDate(row.revokedAt),
  });
}

export function toInviteRow(invite: Invite): InviteRow {
  const { createdAt, revokedAt, ...primitives } = invite.toPrimitives();
  return {
    ...primitives,
    createdAt: instantToDate(createdAt),
    revokedAt: revokedAt == null ? null : instantToDate(revokedAt),
  };
}
