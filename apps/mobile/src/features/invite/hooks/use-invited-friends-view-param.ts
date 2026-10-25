import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

export const InvitedFriendsViewSchema = z.enum(['all', 'waiting']);

export type InvitedFriendsView = z.output<typeof InvitedFriendsViewSchema>;

/** 초대한 친구 목록 보기(?view=all|waiting) */
export function useInvitedFriendsViewParam() {
  const { view } = useLocalSearchParams();
  const setView = useCallback((next: InvitedFriendsView) => router.setParams({ view: next }), []);

  return [InvitedFriendsViewSchema.catch('all').parse(view), setView] as const;
}
