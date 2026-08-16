import { VERIFICATION_CODE, type VerifyEmailInput, verifyEmailSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCooldown } from '@src/features/auth/presentations/hooks/useCooldown';
import { useResendVerificationMutationOptions } from '@src/features/auth/presentations/queries/use-resend-verification-mutation-options';
import { useVerifyEmailMutationOptions } from '@src/features/auth/presentations/queries/use-verify-email-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  H3,
  HStack,
  Result,
  StyledSafeAreaView,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { InputOTP, type InputOTPRef, PressableFeedback } from 'heroui-native';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

/**
 * 독립적인 이메일 인증 화면
 * - 로그인 시 미인증 에러(EMAIL_0503) 발생 시 이동
 */
const VerifyEmailScreen = () => {
  const goBack = useSingleTap(router.back);

  const { t } = useTranslation(['auth']);
  const { email } = useLocalSearchParams<{ email: string }>();
  const toast = useAppToast();

  const inputOTPRef = useRef<InputOTPRef>(null);
  const [cooldown, setCooldown] = useCooldown(0);
  const [isInvalid, setIsInvalid] = useState(false);

  const { control, handleSubmit, setValue, reset } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: email ?? '', code: '' },
  });

  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  const onSubmit = (data: VerifyEmailInput) => {
    setIsInvalid(false);
    verify.mutate(data, {
      onError: (error) => {
        setIsInvalid(true);
        setValue('code', '');
        inputOTPRef.current?.clear();
        toast.error(error, { fallback: t('auth:toasts.codeInvalidFormal') });
      },
    });
  };

  const handleComplete = (code: string) => {
    setValue('code', code);
    handleSubmit(onSubmit)();
  };

  const handleResend = () => {
    if (cooldown > 0 || !email) return;

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

  const maskedEmail = email?.replace(/(.{2})(.*)(@.*)/, '$1****$3') ?? '';

  if (!email) {
    return (
      <StyledSafeAreaView className="flex-1 bg-white items-center justify-center">
        <Result
          title={t('auth:verifyEmail.noEmail')}
          button={
            <Result.Button color="dark" onPress={() => goBack()}>
              {t('auth:verifyEmail.goBack')}
            </Result.Button>
          }
        />
      </StyledSafeAreaView>
    );
  }

  return (
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
            <Controller
              control={control}
              name="code"
              render={({ field: { onChange, value } }) => (
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
            />

            {verify.isPending && (
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
  );
};

export default VerifyEmailScreen;
