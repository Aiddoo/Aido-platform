import { verifyEmailSchema } from '@aido/api';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { H3, HStack, StyledSafeAreaView, Text, TextButton, VStack } from '@src/shared/ui';
import type { InputOTPRef } from 'heroui-native';
import { type ComponentProps, useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useCooldown } from '../hooks/use-cooldown';
import { maskEmail } from '../utils/mask-email';
import {
  getResendCooldownAfterError,
  getResendCooldownAfterSuccess,
} from '../utils/resend-cooldown';
import { VerificationCodeInput } from './verification-code-input';

interface EmailVerificationCodeStepProps extends Pick<
  ComponentProps<typeof VerificationCodeInput>,
  'isSeparated'
> {
  email: string;
  /** 코드를 모두 입력하면 호출한다. reject하면 입력을 비우고 오류 상태로 표시한다. */
  onComplete: (code: string) => Promise<unknown>;
  /** 코드를 다시 보낸다. 성공하면 retryAfterSeconds(없으면 기본값)만큼 재발송을 막는다. */
  onResend: () => Promise<{ retryAfterSeconds?: number }>;
}

/** 이메일로 받은 인증 코드를 입력·재발송하는 단계. 검증과 발송 mutation은 화면이 소유한다. */
export function EmailVerificationCodeStep({
  email,
  onComplete,
  onResend,
  isSeparated,
}: EmailVerificationCodeStepProps) {
  const { t } = useTranslation('auth');
  const { showBoundary } = useErrorBoundary();
  const inputOTPRef = useRef<InputOTPRef>(null);
  const [code, setCode] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useCooldown(0);

  const clearCode = () => {
    setCode('');
    inputOTPRef.current?.clear();
  };

  const handleComplete = async (completedCode: string) => {
    if (!verifyEmailSchema.shape.code.safeParse(completedCode).success) {
      setIsInvalid(true);
      clearCode();
      return;
    }

    setIsInvalid(false);
    setIsVerifying(true);
    try {
      await onComplete(completedCode);
    } catch (error) {
      setIsInvalid(true);
      clearCode();
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) {
      return;
    }

    setIsResending(true);
    try {
      const { retryAfterSeconds } = await onResend();
      setCooldown(getResendCooldownAfterSuccess(retryAfterSeconds));
      setIsInvalid(false);
      clearCode();
    } catch (error) {
      const remainingSeconds = getResendCooldownAfterError(error);
      if (remainingSeconds !== undefined) {
        setCooldown(remainingSeconds);
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <Animated.View
            entering={FadeIn.duration(ANIMATION.duration.slow)}
            style={{ marginBottom: 24 }}
          >
            <H3>{t('verification.codeSentTo', { email: maskEmail(email) })}</H3>
          </Animated.View>

          <VStack gap={32} align="center">
            <VerificationCodeInput
              ref={inputOTPRef}
              isSeparated={isSeparated}
              value={code}
              onChange={setCode}
              onComplete={handleComplete}
              isInvalid={isInvalid}
            />

            {isVerifying && (
              <Text size="b4" className="text-main">
                {t('verification.verifying')}
              </Text>
            )}

            <HStack gap={8} justify="center">
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
        </StyledSafeAreaView>
      </ScrollView>
    </View>
  );
}
