import { VERIFICATION_CODE, type VerifyEmailInput, verifyEmailSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCooldown } from '@src/features/auth/presentations/hooks/use-cooldown';
import {
  verifyEmailScreenParamsSchema,
  useVerifyEmailScreenParams,
} from '@src/features/auth/presentations/hooks/use-verify-email-screen-params';
import { useResendVerificationMutationOptions } from '@src/features/auth/presentations/queries/use-resend-verification-mutation-options';
import { useVerifyEmailMutationOptions } from '@src/features/auth/presentations/queries/use-verify-email-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isBusinessError } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  H3,
  HStack,
  StyledSafeAreaView,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { InputOTP, type InputOTPRef, PressableFeedback } from 'heroui-native';
import { useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/**
 * 독립적인 이메일 인증 화면
 * - 로그인 시 미인증 에러(EMAIL_0503) 발생 시 이동
 */
const VerifyEmailScreen = () => {
  const params = useLocalSearchParams();
  if (!verifyEmailScreenParamsSchema.safeParse(params).success) return <Redirect href="/login" />;
  return <VerifyEmailContent />;
};

function VerifyEmailContent() {
  const { showBoundary } = useErrorBoundary();

  const goBack = useSingleTap(router.back);

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
          toast.success(t('auth:toasts.codeResent'));
        },
        onError: (error) => {
          toast.error(error, { fallback: t('auth:toasts.codeResendFailed') });
        },
      },
    );
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1****$3');

  return (
    <FormProvider {...formMethods}>
      <StyledSafeAreaView className="flex-1 bg-white" edges={['top']}>
        {/* Header */}
        <HStack align="center" px={16} py={12}>
          <PressableFeedback onPress={() => goBack()}>
            <ArrowLeftIcon width={24} height={24} colorClassName="text-gray-8" />
          </PressableFeedback>
          <Text size="b2" weight="semibold" align="center" className="flex-1">
            {t('auth:verifyEmail.title')}
          </Text>
          <View className="w-6" />
        </HStack>

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
                    </InputOTP.Group>
                    <InputOTP.Separator />
                    <InputOTP.Group>
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
      </StyledSafeAreaView>
    </FormProvider>
  );
}

export default VerifyEmailScreen;
