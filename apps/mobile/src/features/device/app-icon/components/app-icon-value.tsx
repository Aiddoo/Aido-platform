import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Text } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Chip } from 'heroui-native';
import { Suspense } from 'react';

import { APP_ICONS } from '../constants/app-icon.constants';
import { useGetCurrentAppIconQueryOptions } from '../queries/app-icon.queries';

/** 앱 아이콘 행의 현재 값. 바꿀 수 없는 무료 사용자에게는 프리미엄 기능이라는 칩을 보인다 */
export function AppIconValue() {
  return (
    <QueryErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <AppIcon />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function AppIcon() {
  const { t } = useTranslation(['appIcon', 'subscription']);
  const [{ data: entitlements }, { data: currentIconKey }] = useSuspenseQueries({
    queries: [useGetEntitlementsQueryOptions(), useGetCurrentAppIconQueryOptions()],
  });
  const currentIcon = APP_ICONS.find((icon) => icon.key === currentIconKey);

  if (!EntitlementPolicy.canUseFeature(entitlements, 'APP_ICON')) {
    // 행 누름을 가로채지 않게 표시만 한다
    return (
      <Chip size="sm" variant="soft" color="accent" pointerEvents="none">
        <Text size="e1" weight="medium" className="text-accent-soft-foreground">
          {t('subscription:tier.premium')}
        </Text>
      </Chip>
    );
  }

  return currentIcon == null ? null : (
    <Text size="b3" shade={7}>
      {t(currentIcon.labelKey)}
    </Text>
  );
}
