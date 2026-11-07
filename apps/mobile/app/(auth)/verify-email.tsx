import { VerifyEmailForm } from '@src/features/identity/auth/components/verify-email-form';
import { verifyEmailParamsSchema } from '@src/features/identity/auth/schemas/verify-email-params.schema';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent } from '@src/shared/ui';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

export default function VerifyEmailScreen() {
  const { t } = useTranslation('auth');
  const params = verifyEmailParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/login" />;
  }

  return (
    <Box className="flex-1 bg-white">
      <Stack.Screen options={{ title: t('verifyEmail.title') }} />

      <ReadableContent flex={1}>
        <VerifyEmailForm />
      </ReadableContent>
    </Box>
  );
}
