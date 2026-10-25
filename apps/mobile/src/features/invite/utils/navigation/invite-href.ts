import type { InviteLinkSource } from '../../domains/invite-redemption.model';
import type { InviteCode } from '../../domains/invite.model';

export function inviteCodeEntryHref() {
  return { pathname: '/invite' } as const;
}

export function inviteCardHref(inviteCode: InviteCode, source: InviteLinkSource) {
  return { pathname: '/invite/[inviteCode]', params: { inviteCode, source } } as const;
}
