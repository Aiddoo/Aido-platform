import { VERIFICATION_CODE, type VerifyEmailInput, verifyEmailSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { VerificationCodeInput } from '@src/features/auth/components/verification-code-input';
import { useCooldown } from '@src/features/auth/hooks/use-cooldown';
import {
  verifyEmailScreenParamsSchema,
  useVerifyEmailScreenParams,
} from '@src/features/auth/hooks/use-verify-email-screen-params';
import { useResendVerificationMutationOptions } from '@src/features/auth/queries/use-resend-verification-mutation-options';
import { useVerifyEmailMutationOptions } from '@src/features/auth/queries/use-verify-email-mutation-options';
import { maskEmail } from '@src/features/auth/utils/mask-email';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isBusinessError } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useTranslation } from '@src/shared/i18n';
import {
  H3,
  HStack,
  ScreenTitleBar,
  StyledSafeAreaView,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { type InputOTPRef } from 'heroui-native';
import { useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useFormState, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/**
 * 독립적인 이메일 인증 화면
 * - 로그인 시 미인증 에러(EMAIL_0503) 발생 시 이동
 */

function VerifyEmailScreen() {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation(['auth']);
  const { email } = useVerifyEmailScreenParams();
  const toast = useAppToast();

  const inputOTPRef = useRef<InputOTPRef>(null);
  const [cooldown, setCooldown] = useCooldown(0);
  const [isInvalid, setIsInvalid] = useState(false);

  const formMethods = useForm({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email, code: '' },
  });
  const { control, handleSubmit, setValue, reset } = formMethods;
  const { isSubmitting } = useFormState({ control: control });

  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  const onSubmit = async (data: VerifyEmailInput) => {
    try {
      setIsInvalid(false);
      await verify.mutateAsync(data, {
        onError: (error) => {
          setIsInvalid(true);
          setValue('code', '');
          inputOTPRef.current?.clear();
          toast.error(error, { fallback: t('auth:toasts.codeInvalidFormal') });
        },
      });
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  const handleComplete = (code: string) => {
    setValue('code', code);
    handleSubmit(onSubmit)();
  };

  const handleResend = () => {
    if (cooldown > 0) {
      return;
    }

    resend.mutate(
      { email },
      {
        onSuccess: (response) => {
          setCooldown(response.retryAfterSeconds ?? VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS);
          reset({ email, code: '' });
          inputOTPRef.current?.clear();
          setIsInvalid(false);
          toast.success(t('auth:toasts.codeResent'));
        },
        onError: (error) => {
          toast.error(error, { fallback: t('auth:toasts.codeResendFailed') });
        },
      },
    );
  };

  const maskedEmail = maskEmail(email);

  return (
    <FormProvider {...formMethods}>
      <StyledSafeAreaView className="flex-1 bg-white" edges={['top']}>
        <ScreenTitleBar title={t('auth:verifyEmail.title')} />

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
                  <VerificationCodeInput
                    isSeparated
                    ref={inputOTPRef}
                    value={value}
                    onChange={onChange}
                    onComplete={handleComplete}
                    isInvalid={isInvalid}
                  />
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
                  isDisabled={cooldown > 0 || resend.isPending}
                >
                  {cooldown > 0
                    ? t('auth:verification.resendIn', { count: cooldown })
                    : t('auth:verification.resend')}
                </TextButton>
              </HStack>
            </VStack>
          </ScrollView>
        </View>
      </StyledSafeAreaView>
    </FormProvider>
  );
}

export default function VerifyEmailRoute() {
  const params = useLocalSearchParams();
  if (!verifyEmailScreenParamsSchema.safeParse(params).success) {
    return <Redirect href="/login" />;
  }
  return <VerifyEmailScreen />;
}
