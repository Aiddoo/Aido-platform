import { EmailVerificationCodeStep } from '@src/features/auth/components/email-verification-code-step';
import {
  verifyEmailScreenParamsSchema,
  useVerifyEmailScreenParams,
} from '@src/features/auth/hooks/use-verify-email-screen-params';
import { useResendVerificationMutationOptions } from '@src/features/auth/queries/use-resend-verification-mutation-options';
import { useVerifyEmailMutationOptions } from '@src/features/auth/queries/use-verify-email-mutation-options';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ReadableContent } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

/** 로그인 중 미인증(EMAIL_0503) 계정이 이메일 인증을 마치는 화면 */
function VerifyEmailScreen() {
  const { t } = useTranslation('auth');
  const { email } = useVerifyEmailScreenParams();
  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: t('verifyEmail.title') }} />

      <ReadableContent flex={1}>
        <EmailVerificationCodeStep
          isSeparated
          email={email}
          onComplete={(code) => verify.mutateAsync({ email, code })}
          onResend={() => resend.mutateAsync({ email })}
        />
      </ReadableContent>
    </View>
  );
}

export default function VerifyEmailRoute() {
  const params = useLocalSearchParams();
  if (!verifyEmailScreenParamsSchema.safeParse(params).success) {
    return <Redirect href="/login" />;
  }
  return (
    <QueryErrorBoundary>
      <VerifyEmailScreen />
    </QueryErrorBoundary>
  );
}
