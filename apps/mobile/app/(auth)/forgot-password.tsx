import { ForgotPasswordForm } from '@src/features/identity/auth/components/forgot-password-form';
import { Box, ReadableContent } from '@src/shared/ui';

export default function ForgotPasswordScreen() {
  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <ForgotPasswordForm />
      </ReadableContent>
    </Box>
  );
}
