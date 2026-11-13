import { getNowInstant } from '@src/shared/date/clock';
import { readStoredValue, removeStoredValue } from '@src/shared/storage/define-stored-value';
import { useStoredValueStorage } from '@src/shared/storage/use-stored-value';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { PendingRedemptionPolicy } from '../domains/pending-redemption.model';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';

/**
 * 로그인 전에 받은 초대(링크·설치 referrer)를 로그인 뒤 첫 화면이 피드를 깔 때 그 위에 한 번 연다. 꺼낸 초대는 바로 지운다.
 * 첫 화면의 Redirect처럼 focus에서 움직여, 자식인 Redirect가 피드로 바꿔 끼운 바로 다음에 이어 열고 피드가 먼저 보이지 않는다.
 * 로그인 전에 보던 카드가 아래에 남아 있으면 초대 route가 singular라 이 카드가 그 자리를 대신한다
 */
export function useOpenPendingInvite({ isEnabled }: { isEnabled: boolean }) {
  const storage = useStoredValueStorage(pendingRedemptionStoredValue);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (!isEnabled) {
        return;
      }
      const pending = readStoredValue(storage, pendingRedemptionStoredValue);
      if (pending == null) {
        return;
      }
      removeStoredValue(storage, pendingRedemptionStoredValue);
      if (!PendingRedemptionPolicy.isFresh(pending, getNowInstant())) {
        return;
      }
      router.navigate({
        pathname: '/invite/[inviteCode]',
        params: { inviteCode: pending.inviteCode, source: pending.source },
      });
    }, [isEnabled, router, storage]),
  );
}
