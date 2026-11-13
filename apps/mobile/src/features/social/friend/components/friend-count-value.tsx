import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { useGetFriendsInfiniteQueryOptions } from '../queries/friend.queries';

/** 친구 관리 행의 현재 친구 수. 친구 목록과 같은 영속 캐시를 읽고, 못 읽으면 값 없이 둔다 */
export function FriendCountValue() {
  return (
    <QueryErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <FriendCount />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function FriendCount() {
  const { t } = useTranslation('friend');
  const { data: friends } = useSuspenseInfiniteQuery(useGetFriendsInfiniteQueryOptions());

  return (
    <SettingsListGroup.Value className="tabular-nums">
      {t('list.countValue', { count: friends.totalCount })}
    </SettingsListGroup.Value>
  );
}
