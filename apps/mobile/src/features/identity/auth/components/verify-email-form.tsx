import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useMutation } from '@tanstack/react-query';

import {
  useResendVerificationMutationOptions,
  useVerifyEmailMutationOptions,
} from '../queries/auth.mutations';
import { verifyEmailParamsSchema } from '../schemas/verify-email-params.schema';
import { EmailVerificationCodeStep } from './email-verification-code-step';

/** 로그인 중 미인증(EMAIL_0503) 계정이 코드로 이메일 인증을 마치는 단계 */
export function VerifyEmailForm() {
  const [{ email }] = useRouteParams(verifyEmailParamsSchema);
  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  return (
    <EmailVerificationCodeStep
      isSeparated
      email={email}
      isVerifying={verify.isPending}
      isResending={resend.isPending}
      onComplete={(code) => verify.mutateAsync({ email, code, source: 'login' })}
      onResend={() => resend.mutateAsync({ email, source: 'login' })}
    />
  );
}
