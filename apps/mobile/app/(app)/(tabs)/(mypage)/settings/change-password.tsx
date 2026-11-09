import { ChangePasswordForm } from '@src/features/identity/auth/components/change-password-form';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent } from '@src/shared/ui';

export default function ChangePasswordScreen() {
  const { t } = useTranslation('auth');

  return (
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
  );
}
