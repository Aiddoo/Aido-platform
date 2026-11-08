import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useMutation } from '@tanstack/react-query';

import {
  useResendVerificationMutationOptions,
  useVerifyEmailMutationOptions,
} from '../queries/auth.mutations';
import { verifyEmailParamsSchema } from '../schemas/verify-email-params.schema';
import { EmailVerificationCodeStep } from './email-verification-code-step';

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
      onComplete={(code) => verify.mutateAsync({ email, code })}
      onResend={() => resend.mutateAsync({ email })}
    />
  );
}
