import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { type User } from '@src/features/identity/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { readStoredValue, removeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useQuery } from '@tanstack/react-query';
import { router, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { PendingRedemptionPolicy } from '../domains/pending-redemption.model';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';

function selectUserId(user: User) {
  return user.id;
}

/**
 * 로그인 전에 연 초대를 로그인 뒤 초대 카드로 이어서 연다(위젯 진입과 같은 방식).
 * 앱 화면이 준비되고 내 정보를 받은 다음에 찾는다. 수락은 카드에서 사용자가 직접 누른다.
 * 초대는 카드가 보이는 순간 지워지고(`InviteCardActions.Redeem`), 같은 초대는 이번 실행에서 한 번만 연다.
 */
export function useInviteAppEntry() {
  const status = useAuthStatus();
  const storage = useStoredValueStorage(pendingRedemptionStoredValue);
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
      const pending = readStoredValue(storage, pendingRedemptionStoredValue);
      if (pending == null) {
        return;
      }
      // 저장소는 기한이 지났을 때만 지운다. 카드가 뜨기 전에 앱이 꺼져도 다음 실행 때 이어서 연다
      if (!PendingRedemptionPolicy.isFresh(pending, getNowInstant())) {
        removeStoredValue(storage, pendingRedemptionStoredValue);
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
  }, [status, isAuthenticatedRouteMounted, userId, storage]);
}
