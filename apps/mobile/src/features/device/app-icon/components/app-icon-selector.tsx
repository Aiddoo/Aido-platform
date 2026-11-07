import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { useTranslation } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';

import { AppIconPolicy } from '../domains/app-icon.model';
import { useChangeAppIconMutationOptions } from '../queries/app-icon.mutations';
import { useGetCurrentAppIconQueryOptions } from '../queries/app-icon.queries';
import type { AppIconKey } from '../schemas/app-icon.schema';
import { AppIconPicker } from './app-icon-picker';

export function AppIconSelector() {
  const { t } = useTranslation(['appIcon', 'common']);
  const { data: currentIconKey } = useSuspenseQuery(useGetCurrentAppIconQueryOptions());
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { mutate: changeIcon, isPending: isChanging } = useMutation(
    useChangeAppIconMutationOptions(),
  );
  const confirmDialog = useConfirmDialog();
  const gate = useEntitlementGate('APP_ICON', { surface: 'app_icon_settings' });
  const currentIcon = currentIconKey ?? 'default';
  const isIconLocked = EntitlementPolicy.isFeatureLocked(entitlements, 'APP_ICON');

  const handleIconPress = async (key: AppIconKey) => {
    if (isChanging || key === currentIcon) {
      return;
    }

    if (AppIconPolicy.isPremiumIcon(key) && gate.promptIfBlocked()) {
      return;
    }

    if (process.env.EXPO_OS === 'android') {
      const isConfirmed = await confirmDialog.open({
        title: t('restartDialog.title'),
        description: t('restartDialog.description'),
        confirmLabel: t('restartDialog.confirm'),
        cancelLabel: t('common:actions.cancel'),
      });
      if (!isConfirmed) {
        return;
      }
    }
    changeIcon(key);
  };

  return (
    <AppIconPicker
      value={currentIcon}
      onValueChange={handleIconPress}
      isDisabled={isChanging}
      isLocked={(key) => isIconLocked && AppIconPolicy.isPremiumIcon(key)}
    />
  );
}
