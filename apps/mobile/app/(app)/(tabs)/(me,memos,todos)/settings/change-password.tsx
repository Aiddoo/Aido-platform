import { ChangePasswordForm } from '@src/features/identity/auth/components/change-password-form';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function ChangePasswordScreen() {
  const { t } = useTranslation(['auth', 'settings']);

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.changePassword') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <ChangePasswordForm
            stepTitles={{
              currentPassword: t('changePassword.currentTitle'),
              newPassword: t('forgotPassword.newPasswordTitle'),
            }}
          />
        </ReadableContent>
      </Box>
    </>
  );
}
