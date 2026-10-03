import type { AppIconKey } from '@src/features/app-icon/models/app-icon.model';
import { AppIconPicker } from '@src/features/app-icon/presentations/components/AppIconPicker';
import { useAppIcon } from '@src/features/app-icon/presentations/hooks/use-app-icon';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  Box,
  ConfirmDialog,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  useOverlay,
  usePremiumDialog,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { Platform, ScrollView } from 'react-native';

export default function AppIconScreen() {
  return (
    <QueryErrorBoundary fallback={(props) => <AppIconPicker.Error {...props} />}>
      <Suspense fallback={<AppIconPicker.Loading />}>
        <AppIconSettings />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function AppIconSettings() {
  const { t } = useTranslation('appIcon');
  const {
    currentIcon,
    isSupported,
    isLoading,
    isChanging,
    changeIcon,
    changeError,
    resetChangeError,
  } = useAppIcon();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);
  const { trackEvent } = useTrack();
  const overlay = useOverlay();
  const premiumDialog = usePremiumDialog();

  const handleIconPress = (key: AppIconKey) => {
    if (isChanging || key === currentIcon) return;

    if (!isPremium && key !== 'default') {
      trackEvent('premium_gate_shown', { feature: 'app_icon' });
      premiumDialog.open({
        description: t('screen.premiumRequired'),
      });
      return;
    }

    if (Platform.OS === 'android') {
      overlay.open(({ isOpen, close, exit }) => (
        <AppIconRestartDialog
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
          onConfirm={() => {
            close();
            exit();
            changeIcon(key);
          }}
        />
      ));
    } else {
      changeIcon(key);
    }
  };

  if (!isSupported) {
    return (
      <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
        <ScrollView className="px-4 flex-1">
          <Spacing size={8} />
          <HStack justify="center" align="center">
            <Text size="b4" shade={6}>
              {t('screen.unsupported')}
            </Text>
          </HStack>
        </ScrollView>
      </StyledSafeAreaView>
    );
  }

  if (isLoading) return <AppIconPicker.Loading />;

  return (
    <>
      <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
        <ScrollView className="px-4 flex-1">
          <Spacing size={8} />
          <Text size="b4" shade={6} className="px-2 pb-2">
            {t('screen.chooseIcon')}
          </Text>

          <Box p={16} className="bg-white rounded-2xl">
            <AppIconPicker
              value={currentIcon}
              onChange={handleIconPress}
              isDisabled={isChanging}
              isLocked={(key) => !isPremium && key !== 'default'}
            />
          </Box>
        </ScrollView>
      </StyledSafeAreaView>
      <AppIconErrorDialog
        isOpen={changeError !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) resetChangeError();
        }}
      />
    </>
  );
}

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
