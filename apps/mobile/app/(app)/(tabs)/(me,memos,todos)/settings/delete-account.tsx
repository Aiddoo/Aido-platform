import { DeleteAccountForm } from '@src/features/identity/auth/components/delete-account-form';
import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { Box, InlineAlert, ReadableContent, Spacing } from '@src/shared/ui';
import { Stack } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function DeleteAccountRoute() {
  const { t } = useTranslation(['auth', 'settings']);

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.deleteAccount') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <DeleteAccountForm
            title={t('deleteAccount.passwordTitle')}
            footer={
              <Animated.View
                entering={FadeIn.duration(ANIMATION.durationMs.normal).delay(
                  ANIMATION.delayMs.short,
                )}
              >
                <Spacing size={16} />
                <InlineAlert
                  status="warning"
                  title={t('deleteAccount.restoreNotice')}
                  description={t('deleteAccount.purgeNotice')}
                />
              </Animated.View>
            }
          />
        </ReadableContent>
      </Box>
    </>
  );
}
