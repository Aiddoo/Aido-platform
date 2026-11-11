import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
import { getNowInstant } from '@src/shared/date/clock';
import { readStoredValue, removeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { router, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { PendingRedemptionPolicy } from '../domains/pending-redemption.model';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';

/** 로그인 전에 연 초대를 앱 화면·내 정보가 준비된 뒤 초대 카드로 이어 연다. 같은 초대는 이번 실행에서 한 번만 열고 카드가 보이면 지운다(`InviteCardActions.Redeem`) */
export function useInviteAppEntry() {
  const status = useAuthStatus();
  const storage = useStoredValueStorage(pendingRedemptionStoredValue);
  const segments = useSegments();
  const userId = useMyAccountId({ isEnabled: status === 'authenticated' });
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
