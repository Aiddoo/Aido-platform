import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useInviteService } from '@src/bootstrap/providers/di-context';
import type { User } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useQuery } from '@tanstack/react-query';
import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { inviteCardHref } from '../utils/navigation/invite-href';

const selectUserId = (user: User) => user.id;

/**
 * 로그인 전에 연 초대를 로그인 뒤 초대 카드로 이어서 연다(위젯 진입과 같은 방식).
 * 앱 화면이 준비되고 내 정보를 받은 다음에 꺼낸다. 수락은 카드에서 사용자가 직접 누른다.
 */
export function useInviteAppEntry() {
  const { status } = useAuth();
  const inviteService = useInviteService();
  const segments = useSegments();
  const { data: userId } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: status === 'authenticated',
    throwOnError: false,
    select: selectUserId,
  });
  const isAuthenticatedRouteMounted = segments[0] === '(app)';

  useEffect(() => {
    if (status !== 'authenticated' || !isAuthenticatedRouteMounted || userId == null) {
      return;
    }

    // 첫 화면이 그려진 다음 프레임에 이동해야 탭 화면이 아래에 남는다
    const frameId = requestAnimationFrame(() => {
      const pending = inviteService.takePendingRedemption(new Date());
      if (pending == null) {
        return;
      }

      router.navigate(inviteCardHref(pending.inviteCode, pending.source));
    });

    return () => cancelAnimationFrame(frameId);
  }, [status, isAuthenticatedRouteMounted, userId, inviteService]);
}
