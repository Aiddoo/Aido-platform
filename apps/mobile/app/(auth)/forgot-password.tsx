import { ForgotPasswordForm } from '@src/features/identity/auth/components/forgot-password-form';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent } from '@src/shared/ui';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation('auth');

  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <ForgotPasswordForm
          stepTitles={{
            email: t('forgotPassword.emailTitle'),
            newPassword: t('forgotPassword.newPasswordTitle'),
          }}
        />
      </ReadableContent>
    </Box>
  );
}
