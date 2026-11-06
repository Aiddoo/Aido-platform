import { useAppIconService } from '@src/bootstrap/providers/di-context';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/get-entitlements-query-options';
import { AppIconPicker } from '@src/features/device/app-icon/components/app-icon-picker';
import { AppIconPolicy } from '@src/features/device/app-icon/domains/app-icon.model';
import { useChangeAppIconMutationOptions } from '@src/features/device/app-icon/queries/app-icon.mutations';
import { useGetCurrentAppIconQueryOptions } from '@src/features/device/app-icon/queries/app-icon.queries';
import type { AppIconKey } from '@src/features/device/app-icon/schemas/app-icon.schema';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  ConfirmDialog,
  HStack,
  QueryErrorBoundary,
  SettingsCard,
  SettingsScreenLayout,
  Text,
  useOverlay,
} from '@src/shared/ui';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

function AppIconScreen() {
  const { t } = useTranslation('appIcon');
  const appIconService = useAppIconService();
  const { data: currentIconKey, isPending: isCurrentIconPending } = useQuery(
    useGetCurrentAppIconQueryOptions(),
  );
  const {
    mutate: changeIcon,
    isPending: isChanging,
    error: changeError,
    reset: resetChangeError,
  } = useMutation(useChangeAppIconMutationOptions());
  const currentIcon = currentIconKey ?? 'default';
  const isSupported = appIconService.isSupported();
  const isLoading = isSupported && isCurrentIconPending;
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const isIconLocked = EntitlementPolicy.isFeatureLocked(entitlements, 'APP_ICON');
  const overlay = useOverlay();
  const gate = useEntitlementGate('APP_ICON', { surface: 'app_icon_settings' });

  const handleIconPress = (key: AppIconKey) => {
    if (isChanging || key === currentIcon) {
      return;
    }

    if (AppIconPolicy.requiresPremium(key) && !gate.guard()) {
      return;
    }

    if (process.env.EXPO_OS === 'android') {
      overlay.open(({ isOpen, close, unmount }) => (
        <AppIconRestartDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              unmount();
            }
          }}
          onConfirm={() => {
            close();
            unmount();
            changeIcon(key);
          }}
        />
      ));
    } else {
      changeIcon(key);
    }
  };

  return match({ isSupported, isLoading })
    .with({ isSupported: false }, () => (
      <SettingsScreenLayout>
        <HStack justify="center" align="center">
          <Text size="b4" shade={6}>
            {t('screen.unsupported')}
          </Text>
        </HStack>
      </SettingsScreenLayout>
    ))
    .with({ isSupported: true, isLoading: true }, () => <AppIconScreen.Loading />)
    .with({ isSupported: true, isLoading: false }, () => (
      <>
        <SettingsScreenLayout gap={8}>
          <Text size="b4" shade={6} className="px-2">
            {t('screen.chooseIcon')}
          </Text>

          <SettingsCard>
            <SettingsCard.Content>
              <AppIconPicker
                value={currentIcon}
                onChange={handleIconPress}
                isDisabled={isChanging}
                isLocked={(key) => isIconLocked && AppIconPolicy.requiresPremium(key)}
              />
            </SettingsCard.Content>
          </SettingsCard>
        </SettingsScreenLayout>
        <AppIconErrorDialog
          isOpen={changeError != null}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              resetChangeError();
            }
          }}
        />
      </>
    ))
    .exhaustive();
}

AppIconScreen.Loading = function Loading() {
  const { t } = useTranslation('appIcon');
  return (
    <SettingsScreenLayout gap={8}>
      <Text size="b4" shade={6} className="px-2">
        {t('screen.chooseIcon')}
      </Text>

      <SettingsCard>
        <SettingsCard.Content>
          <AppIconPicker.Loading />
        </SettingsCard.Content>
      </SettingsCard>
    </SettingsScreenLayout>
  );
};

interface AppIconRestartDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function AppIconRestartDialog({ isOpen, onOpenChange, onConfirm }: AppIconRestartDialogProps) {
  const { t } = useTranslation('appIcon');
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{t('restartDialog.title')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>{t('restartDialog.description')}</ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          {tGlobal('common:actions.cancel')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={onConfirm}>
          {t('restartDialog.confirm')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

interface AppIconErrorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function AppIconErrorDialog({ isOpen, onOpenChange }: AppIconErrorDialogProps) {
  const { t } = useTranslation('appIcon');
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{t('errorDialog.title')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>{t('errorDialog.description')}</ConfirmDialog.Description>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={() => onOpenChange(false)}>
          {tGlobal('common:actions.confirm')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

export default function AppIconRoute() {
  return (
    <QueryErrorBoundary fallback={AppIconPicker.Error}>
      <Suspense fallback={<AppIconScreen.Loading />}>
        <AppIconScreen />
      </Suspense>
    </QueryErrorBoundary>
  );
}
