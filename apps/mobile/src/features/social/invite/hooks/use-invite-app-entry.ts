import { useInviteService } from '@src/bootstrap/providers/di-context';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import type { User } from '@src/features/identity/user/schemas/user.schema';
import { getNowInstant } from '@src/shared/date/instant';
import { useQuery } from '@tanstack/react-query';
import { router, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

function selectUserId(user: User) {
  return user.id;
}

/**
 * 로그인 전에 연 초대를 로그인 뒤 초대 카드로 이어서 연다(위젯 진입과 같은 방식).
 * 앱 화면이 준비되고 내 정보를 받은 다음에 찾는다. 수락은 카드에서 사용자가 직접 누른다.
 * 초대는 수락하거나 끝난 실패일 때 지우고, 같은 초대는 이번 실행에서 한 번만 연다.
 */
export function useInviteAppEntry() {
  const status = useAuthStatus();
  const inviteService = useInviteService();
  const segments = useSegments();
  const { data: userId } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: status === 'authenticated',
    throwOnError: false,
    select: selectUserId,
  });
  const isAuthenticatedRouteMounted = segments[0] === '(app)';
  const openedPendingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !isAuthenticatedRouteMounted || userId == null) {
      return;
    }

    // 첫 화면이 그려진 다음 프레임에 이동해야 탭 화면이 아래에 남는다
    const frameId = requestAnimationFrame(() => {
      const now = getNowInstant();
      inviteService.discardStalePendingRedemption(now);
      const pending = inviteService.findFreshPendingRedemption(now);
      if (pending == null) {
        return;
      }

      const pendingKey = `${userId}:${pending.inviteCode}:${pending.savedAt}`;
      if (openedPendingKeyRef.current === pendingKey) {
        return;
      }

      openedPendingKeyRef.current = pendingKey;
      router.navigate({
        pathname: '/invite/[inviteCode]',
        params: { inviteCode: pending.inviteCode, source: pending.source },
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [status, isAuthenticatedRouteMounted, userId, inviteService]);
}
