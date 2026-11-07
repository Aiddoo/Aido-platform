import { ChangePasswordForm } from '@src/features/identity/auth/components/change-password-form';
import { Box, ReadableContent } from '@src/shared/ui';

export default function ChangePasswordScreen() {
  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <ChangePasswordForm />
      </ReadableContent>
    </Box>
  );
}
