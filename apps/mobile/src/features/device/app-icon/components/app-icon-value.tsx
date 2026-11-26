import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { APP_ICONS } from '@src/shared/constants/app-icons';
import { useTranslation } from '@src/shared/i18n';
import {
  LabelChip,
  QueryErrorBoundary,
  QueryErrorFallback,
  SettingsListGroup,
} from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { Suspense } from 'react';

import { useGetCurrentAppIconQueryOptions } from '../queries/app-icon.queries';

export function AppIconValue() {
  return (
    <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
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
    return <LabelChip color="accent" label={t('subscription:tier.premium')} pointerEvents="none" />;
  }

  return currentIcon == null ? null : (
    <SettingsListGroup.Value>{t(currentIcon.labelKey)}</SettingsListGroup.Value>
  );
}
