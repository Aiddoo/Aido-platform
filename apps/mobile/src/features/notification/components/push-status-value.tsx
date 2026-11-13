import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Suspense } from 'react';

import { useGetPushPermissionQueryOptions } from '../queries/push-permission.queries';
import { getPushSummaryLabelKey, toPushSummary } from '../utils/push-permission.view-model';

/** 알림 설정 행의 현재 값. 알림 설정 화면의 푸시 값과 같은 말을 쓴다. 못 읽으면 값 없이 둔다 */
export function PushStatusValue() {
  return (
    <QueryErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <PushStatus />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function PushStatus() {
  const { t } = useTranslation('notification');
  const [{ data: permission }, { data: preference }] = useSuspenseQueries({
    queries: [useGetPushPermissionQueryOptions(), useGetPreferenceQueryOptions()],
  });

  return (
    <SettingsListGroup.Value testID="push-status-value">
      {t(getPushSummaryLabelKey(toPushSummary(permission, preference)))}
    </SettingsListGroup.Value>
  );
}
