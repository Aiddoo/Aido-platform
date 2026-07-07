import { APP_ICONS, getAppIconLabel } from '@src/features/app-icon/constants/app-icons.constant';
import { useAppIcon } from '@src/features/app-icon/hooks/use-app-icon';
import type { AppIconKey } from '@src/features/app-icon/types/app-icon.types';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { t as tGlobal, useTranslation } from '@src/shared/i18n';
import {
  Avatar,
  Box,
  ConfirmDialog,
  CrownIcon,
  Grid,
  GridItem,
  HStack,
  Spacing,
  StyledSafeAreaView,
  Text,
  useOverlay,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback } from 'heroui-native';
import { Platform, ScrollView, View } from 'react-native';

const AppIconScreen = () => {
  const { t } = useTranslation('appIcon');
  const { currentIcon, isSupported, isChanging, changeIcon } = useAppIcon();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);
  const { trackEvent } = useTrack();
  const overlay = useOverlay();
  const premiumDialog = usePremiumDialog();

  const handleIconPress = (key: AppIconKey) => {
    if (!isPremium && key !== 'default') {
      trackEvent('premium_gate_shown', { feature: 'app_icon' });
      premiumDialog.open({
        description: t('screen.premiumRequired'),
      });
      return;
    }

    const applyIcon = async () => {
      try {
        await changeIcon(key);
      } catch {
        overlay.open(({ isOpen, close, exit }) => (
          <AppIconErrorDialog
            isOpen={isOpen}
            onOpenChange={(open) => {
              if (!open) {
                close();
                exit();
              }
            }}
          />
        ));
      }
    };

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
            applyIcon();
          }}
        />
      ));
    } else {
      applyIcon();
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

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={8} />
        <Text size="b4" shade={6} className="px-2 pb-2">
          {t('screen.chooseIcon')}
        </Text>

        <Box p={16} className="bg-white rounded-2xl">
          <Grid columns={3}>
            {APP_ICONS.map((icon) => {
              const selected = icon.key === currentIcon;
              const locked = !isPremium && icon.key !== 'default';
              return (
                <GridItem key={icon.key} p={8} className="items-center">
                  <PressableFeedback
                    isDisabled={isChanging}
                    onPress={() => handleIconPress(icon.key)}
                    className="rounded-2xl overflow-visible"
                  >
                    <VStack align="center" gap={8} p={8} className="overflow-visible">
                      <View>
                        <Avatar
                          isSelected={selected}
                          alt={getAppIconLabel(icon)}
                          className="w-20 h-20 rounded-2xl"
                        >
                          <Avatar.Image source={icon.preview} />
                        </Avatar>
                        {locked && (
                          <View className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gray-8 dark:bg-gray-2 dark:border-gray-4  border-gray-8 border items-center justify-center z-10">
                            <CrownIcon width={14} height={14} />
                          </View>
                        )}
                      </View>
                      <Text
                        size="b4"
                        weight={selected ? 'semibold' : 'normal'}
                        shade={selected ? 9 : 6}
                        numberOfLines={1}
                      >
                        {getAppIconLabel(icon)}
                      </Text>
                    </VStack>
                    <PressableFeedback.Highlight className="rounded-2xl" />
                  </PressableFeedback>
                </GridItem>
              );
            })}
          </Grid>
        </Box>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default AppIconScreen;

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
