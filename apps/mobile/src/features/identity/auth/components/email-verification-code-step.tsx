import { VERIFICATION_CODE } from '@aido/api/vocabulary';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton, VStack, FormStepLayout, Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import type { InputOTPRef } from 'heroui-native';
import { type ComponentProps, useRef, useState } from 'react';

import { findResendCooldown } from '../domains/auth.error';
import { useCooldown } from '../hooks/use-cooldown';
import { verificationCodeSchema } from '../schemas/verify-email-params.schema';
import { maskEmail } from '../utils/mask-email';
import { VerificationCodeInput } from './verification-code-input';

interface EmailVerificationCodeStepProps extends Pick<
  ComponentProps<typeof VerificationCodeInput>,
  'isSeparated'
> {
  email: string;
  /** 서버가 이 코드를 거절해 돌아왔다. 칸을 오류로 보이고 비운 채 연다 */
  isRejected?: boolean;
  isVerifying?: boolean;
  isResending?: boolean;
  /** 코드를 모두 입력하면 호출한다. reject하면 입력을 비우고 오류 상태로 표시한다. */
  onComplete: (code: string) => Promise<unknown>;
  /** 코드를 다시 보낸다. 성공하면 retryAfterSeconds(없으면 기본값)만큼 재발송을 막는다. */
  onResend: () => Promise<{ retryAfterSeconds?: number }>;
}

/** 검증과 발송 mutation은 화면이 소유한다 */
export function EmailVerificationCodeStep({
  email,
  onComplete,
  onResend,
  isRejected = false,
  isVerifying = false,
  isResending = false,
  isSeparated,
}: EmailVerificationCodeStepProps) {
  const { t } = useTranslation('auth');
  const inputOTPRef = useRef<InputOTPRef>(null);
  const [code, setCode] = useState('');
  const [isInvalid, setIsInvalid] = useState(isRejected);
  const [cooldown, startCooldown] = useCooldown();

  const clearCode = () => {
    setCode('');
    inputOTPRef.current?.clear();
  };

  const handleComplete = async (completedCode: string) => {
    if (!verificationCodeSchema.safeParse(completedCode).success) {
      setIsInvalid(true);
      clearCode();
      return;
    }

    setIsInvalid(false);
    try {
      await onComplete(completedCode);
    } catch {
      setIsInvalid(true);
      clearCode();
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) {
      return;
    }

    try {
      const { retryAfterSeconds } = await onResend();
      startCooldown(retryAfterSeconds ?? VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS);
      setIsInvalid(false);
      clearCode();
    } catch (error) {
      const remainingSeconds = findResendCooldown(error);
      if (remainingSeconds != null) {
        startCooldown(remainingSeconds);
      }
    }
  };

  return (
    <Box className="flex-1">
      <FormStepLayout title={t('verification.codeSentTo', { email: maskEmail(email) })}>
        <VStack gap={32} align="center">
          <VerificationCodeInput
            ref={inputOTPRef}
            isSeparated={isSeparated}
            value={code}
            onChange={setCode}
            onComplete={handleComplete}
            isInvalid={isInvalid}
          />

          {/* 확인 중 줄이 생겼다 사라지며 아래 재발송 줄이 밀리지 않게 자리를 항상 둔다 */}
          <Text size="b4" className={cn('text-main', !isVerifying && 'opacity-0')}>
            {t('verification.verifying')}
          </Text>

          {/* 다시 보낼 수 있을 때까지의 안내가 좁은 화면·큰 글꼴에서 넘치지 않게 줄을 바꾼다 */}
          <HStack gap={8} justify="center" wrap="wrap">
            <Text size="b4" shade={7}>
              {t('verification.didNotReceive')}
            </Text>
            <TextButton
              size="medium"
              onPress={handleResend}
              isDisabled={cooldown > 0 || isResending}
            >
              {cooldown > 0
                ? t('verification.resendIn', { count: cooldown })
                : t('verification.resend')}
            </TextButton>
          </HStack>
        </VStack>
      </FormStepLayout>
    </Box>
  );
}
