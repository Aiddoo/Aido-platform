import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Text } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Suspense } from 'react';

import { PushPermissionPolicy } from '../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../queries/notification.queries';

/** 알림 설정 행의 현재 값. 기기 권한과 앱 알림이 모두 켜져야 켜짐이다. 못 읽으면 값 없이 둔다 */
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
  const canReceivePush = PushPermissionPolicy.canReceivePush(permission, {
    pushEnabled: preference.pushEnabled,
  });

  return (
    <Text size="b3" shade={7} testID="push-status-value">
      {canReceivePush ? t('settings.on') : t('settings.off')}
    </Text>
  );
}
