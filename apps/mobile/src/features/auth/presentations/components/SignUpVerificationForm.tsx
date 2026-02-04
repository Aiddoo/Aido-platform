import { VERIFICATION_CODE, type VerifyEmailInput, verifyEmailSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import type { SignUpFormData } from '@src/features/auth/models/auth.model';
import { useCooldown } from '@src/features/auth/presentations/hooks/useCooldown';
import { resendVerificationMutationOptions } from '@src/features/auth/presentations/queries/resend-verification-mutation-options';
import { verifyEmailMutationOptions } from '@src/features/auth/presentations/queries/verify-email-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Text } from '@src/shared/ui/Text/Text';
import { H3 } from '@src/shared/ui/Text/Typography';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { InputOTP, type InputOTPRef } from 'heroui-native';
import { useRef, useState } from 'react';
import { Controller, useForm, useFormContext } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export const SignUpVerificationForm = () => {
  const { getValues } = useFormContext<SignUpFormData>();
  const toast = useAppToast();
  const email = getValues('email');

  const inputOTPRef = useRef<InputOTPRef>(null);
  const [cooldown, setCooldown] = useCooldown(0);
  const [isInvalid, setIsInvalid] = useState(false);

  const { control, handleSubmit, setValue, reset } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email, code: '' },
  });

  const verify = useMutation(verifyEmailMutationOptions());
  const resend = useMutation(resendVerificationMutationOptions());

  const onSubmit = (data: VerifyEmailInput) => {
    setIsInvalid(false);
    verify.mutate(data, {
      onError: (error) => {
        setIsInvalid(true);
        setValue('code', '');
        inputOTPRef.current?.clear();
        toast.error(error, { fallback: '인증 코드가 올바르지 않습니다' });
      },
    });
  };

  const handleComplete = (code: string) => {
    setValue('code', code);
    handleSubmit(onSubmit)();
  };

  const handleResend = () => {
    if (cooldown > 0) return;

    resend.mutate(
      { email },
      {
        onSuccess: (response) => {
          setCooldown(response.retryAfterSeconds ?? VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS);
          reset({ email, code: '' });
          inputOTPRef.current?.clear();
          setIsInvalid(false);
          toast.success('인증 코드가 재발송되었습니다');
        },
        onError: (error) => {
          toast.error(error, { fallback: '인증 코드 재발송에 실패했습니다' });
        },
      },
    );
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1****$3');

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeIn.duration(ANIMATION.duration.slow)}
          style={{ marginBottom: 24 }}
        >
          <H3>
            {maskedEmail}로{'\n'}발송된 코드를 입력해주세요
          </H3>
        </Animated.View>

        <VStack gap={32} align="center">
          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, value } }) => (
              <InputOTP
                ref={inputOTPRef}
                maxLength={6}
                value={value}
                onChange={onChange}
                onComplete={handleComplete}
                isInvalid={isInvalid}
              >
                <InputOTP.Group>
                  <InputOTP.Slot index={0} />
                  <InputOTP.Slot index={1} />
                  <InputOTP.Slot index={2} />
                </InputOTP.Group>
                <InputOTP.Separator />
                <InputOTP.Group>
                  <InputOTP.Slot index={3} />
                  <InputOTP.Slot index={4} />
                  <InputOTP.Slot index={5} />
                </InputOTP.Group>
              </InputOTP>
            )}
          />

          {verify.isPending && (
            <Text size="b4" className="text-main">
              인증 중...
            </Text>
          )}

          <HStack gap={8} justify="center">
            <Text size="b4" shade={7}>
              코드를 받지 못하셨나요?
            </Text>
            <TextButton
              size="medium"
              onPress={handleResend}
              disabled={cooldown > 0 || resend.isPending}
            >
              {cooldown > 0 ? `${cooldown}초 후 재발송` : '인증코드 재발송'}
            </TextButton>
          </HStack>
        </VStack>
      </ScrollView>
    </View>
  );
};
