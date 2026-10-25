import type { InviteLinkSource } from '../../domains/invite-redemption.model';
import type { InviteCode } from '../../domains/invite.model';
import type { InvitedFriendsView } from '../../hooks/use-invited-friends-view-param';

export function inviteCodeEntryHref() {
  return { pathname: '/invite' } as const;
}

export function inviteCardHref(inviteCode: InviteCode, source: InviteLinkSource) {
  return { pathname: '/invite/[inviteCode]', params: { inviteCode, source } } as const;
}

export function myInviteHref() {
  return { pathname: '/friends/invite' } as const;
}

export function invitedFriendsHref(view: InvitedFriendsView = 'all') {
  return { pathname: '/friends/invite/invitees', params: { view } } as const;
}

export function inviteWelcomeSheetHref(friendId: string) {
  return { pathname: '/invite-welcome/[friendId]', params: { friendId } } as const;
}
