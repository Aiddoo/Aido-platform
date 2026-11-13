import { VerifyEmailForm } from '@src/features/identity/auth/components/verify-email-form';
import { verifyEmailParamsSchema } from '@src/features/identity/auth/schemas/verify-email-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useTranslation } from '@src/shared/i18n';
import { Box, ReadableContent } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function VerifyEmailScreen() {
  const { t } = useTranslation('auth');
  const route = useRouteParamsOrRedirect(verifyEmailParamsSchema, { fallbackHref: '/login' });

  if (route.redirect != null) {
    return route.redirect;
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
