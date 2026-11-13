import { VERIFICATION_CODE } from '@aido/api/vocabulary';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { getNowInstant } from '@src/shared/date/clock';
import { fromEpochMs, toEpochMs } from '@src/shared/date/instant';
import { useNow } from '@src/shared/hooks/use-now';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextButton, VStack, FormStepLayout, Box } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { range } from 'es-toolkit';
import { InputOTP, type InputOTPRef } from 'heroui-native';
import { type ComponentProps, useCallback, useRef, useState } from 'react';

import { findResendCooldown } from '../domains/auth.error';
import { isVerificationCode } from '../domains/auth.model';
import { getRemainingCooldownSeconds } from '../utils/cooldown.view-model';
import { maskEmail } from '../utils/email.view-model';

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
  /** 코드를 다시 보낸다. 성공하면 retryAfterSeconds(null이면 기본값)만큼 재발송을 막는다. */
  onResend: () => Promise<{ retryAfterSeconds: number | null }>;
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
    if (!isVerificationCode(completedCode)) {
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

interface VerificationCodeInputProps extends Omit<
  ComponentProps<typeof InputOTP>,
  'maxLength' | 'children'
> {
  /** 코드를 절반씩 나누고 가운데 구분선을 보여 준다. */
  isSeparated?: boolean;
}

/** 서버 인증 코드 길이만큼 칸을 만드는 인증 코드 입력 */
function VerificationCodeInput({ isSeparated = false, ...props }: VerificationCodeInputProps) {
  const half = Math.ceil(VERIFICATION_CODE.LENGTH / 2);

  return (
    <InputOTP maxLength={VERIFICATION_CODE.LENGTH} {...props}>
      {isSeparated ? (
        <>
          <InputOTP.Group>
            {range(half).map((index) => (
              <InputOTP.Slot key={index} index={index} />
            ))}
          </InputOTP.Group>
          <InputOTP.Separator />
          <InputOTP.Group>
            {range(VERIFICATION_CODE.LENGTH - half).map((offset) => (
              <InputOTP.Slot key={half + offset} index={half + offset} />
            ))}
          </InputOTP.Group>
        </>
      ) : (
        <InputOTP.Group>
          {range(VERIFICATION_CODE.LENGTH).map((index) => (
            <InputOTP.Slot key={index} index={index} />
          ))}
        </InputOTP.Group>
      )}
    </InputOTP>
  );
}

/** 1초 타이머를 이어 세면 iOS 백그라운드에서 멈춘 만큼 늦어져 마감 시각과의 차이를 틱과 앱 복귀 때 다시 계산한다 */
function useCooldown() {
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const now = useNow({
    tickMs: SECOND_MS,
    until: deadlineMs == null ? null : fromEpochMs(deadlineMs),
    isEnabled: deadlineMs != null,
  });
  const cooldown = getRemainingCooldownSeconds(deadlineMs, toEpochMs(now));

  const startCooldown = useCallback((seconds: number) => {
    setDeadlineMs(toEpochMs(getNowInstant()) + seconds * SECOND_MS);
  }, []);

  return [cooldown, startCooldown] as const;
}
