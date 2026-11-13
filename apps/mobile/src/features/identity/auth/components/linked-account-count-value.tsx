import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import { LinkedAccountsPolicy } from '../domains/oauth.model';
import { useGetLinkedAccountsQueryOptions } from '../queries/auth.queries';

/** 연결된 계정 행의 현재 값. 못 읽으면 값 없이 둔다 */
export function LinkedAccountCountValue() {
  return (
    <QueryErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <LinkedAccountCount />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function LinkedAccountCount() {
  const { t } = useTranslation('auth');
  const { data: linkedCount } = useSuspenseQuery({
    ...useGetLinkedAccountsQueryOptions(),
    select: LinkedAccountsPolicy.countLinkedAccounts,
  });

  return (
    <SettingsListGroup.Value className="tabular-nums" testID="linked-account-count-value">
      {t('linkedAccounts.countValue', { count: linkedCount })}
    </SettingsListGroup.Value>
  );
}
