import { ErrorCode } from '@aido/errors';
import { VERIFICATION_CODE, type VerifyEmailInput, verifyEmailSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { ApiError } from '@src/shared/errors/api-error';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { H3, HStack, Text, TextButton, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { InputOTP, type InputOTPRef } from 'heroui-native';
import { useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm, useFormContext } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useCooldown } from '../hooks/use-cooldown';
import { useResendVerificationMutationOptions } from '../queries/use-resend-verification-mutation-options';
import { useVerifyEmailMutationOptions } from '../queries/use-verify-email-mutation-options';
import type { SignUpFormData } from '../schemas/sign-up-form.schema';

export const SignUpVerificationForm = () => {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation(['auth']);
  const { getValues } = useFormContext<SignUpFormData>();

  const email = getValues('email');

  const inputOTPRef = useRef<InputOTPRef>(null);
  const [cooldown, setCooldown] = useCooldown(0);
  const [isInvalid, setIsInvalid] = useState(false);

  const formMethods = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email, code: '' },
  });
  const { control, handleSubmit, setValue, reset } = formMethods;
  const { isSubmitting } = useFormState({ control });

  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  const onSubmit = async (data: VerifyEmailInput) => {
    try {
      setIsInvalid(false);
      await verify.mutateAsync(data, {
        onError: () => {
          setIsInvalid(true);
          setValue('code', '');
          inputOTPRef.current?.clear();
        },
      });
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
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
        },
        onError: (error) => {
          if (error instanceof ApiError && error.hasCode(ErrorCode.VERIFY_0753)) {
            const remaining = error.details?.remainingSeconds;
            if (typeof remaining === 'number') {
              setCooldown(remaining);
            }
          }
        },
      },
    );
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1****$3');

  return (
    <FormProvider {...formMethods}>
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
            <H3>{t('auth:verification.codeSentTo', { email: maskedEmail })}</H3>
          </Animated.View>

          <VStack gap={32} align="center">
            <FormField control={control} name="code">
              {({ onChange, value }) => (
                <InputOTP
                  ref={inputOTPRef}
                  maxLength={VERIFICATION_CODE.LENGTH}
                  value={value}
                  onChange={onChange}
                  onComplete={handleComplete}
                  isInvalid={isInvalid}
                >
                  <InputOTP.Group>
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                    <InputOTP.Slot index={3} />
                    <InputOTP.Slot index={4} />
                    <InputOTP.Slot index={5} />
                  </InputOTP.Group>
                </InputOTP>
              )}
            </FormField>

            {isSubmitting && (
              <Text size="b4" className="text-main">
                {t('auth:verification.verifying')}
              </Text>
            )}

            <HStack gap={8} justify="center">
              <Text size="b4" shade={7}>
                {t('auth:verification.didNotReceive')}
              </Text>
              <TextButton
                size="medium"
                onPress={handleResend}
                disabled={cooldown > 0 || resend.isPending}
              >
                {cooldown > 0
                  ? t('auth:verification.resendIn', { count: cooldown })
                  : t('auth:verification.resend')}
              </TextButton>
            </HStack>
          </VStack>
        </ScrollView>
      </View>
    </FormProvider>
  );
};
