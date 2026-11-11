import { useTranslation } from '@src/shared/i18n';
import { useSuspenseQuery } from '@tanstack/react-query';

import { PushPermissionPolicy } from '../../domains/push-permission.model';
import { useGetPushPermissionQueryOptions } from '../../queries/push-permission.queries';

/** 광고성 앱 푸시 설명. 동의는 그대로 바꿀 수 있지만 기기 알림이 꺼져 있으면 지금은 닿지 않는다는 것을 알린다 */
export function MarketingPushDescription() {
  const { t } = useTranslation('notification');
  const { data: permission } = useSuspenseQuery(useGetPushPermissionQueryOptions());

  return PushPermissionPolicy.isPushDeliverable(permission)
    ? t('settings.marketingPushDescription')
    : t('settings.marketingPushDeviceOff');
}
