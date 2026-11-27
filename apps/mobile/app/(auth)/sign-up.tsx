import ConfirmationNumber from '@expo/material-symbols/confirmation_number.xml';
import { zodResolver } from '@hookform/resolvers/zod';
import { toRegisterRequest } from '@src/features/identity/auth/apis/auth.mapper';
import { EmailVerificationCodeStep } from '@src/features/identity/auth/components/email-verification-code-step';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import { PasswordStrengthIndicator } from '@src/features/identity/auth/components/password-strength-indicator';
import { RevealedField } from '@src/features/identity/auth/components/revealed-field';
import { SuggestedEmailDomainList } from '@src/features/identity/auth/components/suggested-email-domain-list';
import { TermsAgreementBottomSheet } from '@src/features/identity/auth/components/terms-agreement-bottom-sheet';
import { useFocusOnStepBack } from '@src/features/identity/auth/hooks/use-focus-on-step-back';
import {
  useRegisterMutationOptions,
  useResendVerificationMutationOptions,
  useVerifyEmailMutationOptions,
} from '@src/features/identity/auth/queries/auth.mutations';
import {
  signUpFormSchema,
  type SignUpFormValues,
} from '@src/features/identity/auth/schemas/sign-up-form.schema';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import { useDismissKeyboard } from '@src/shared/hooks/use-dismiss-keyboard';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Box,
  FormStepLayout,
  Input,
  KeyboardAdaptiveButton,
  ReadableContent,
  Spacing,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Controller,
  FormState,
  useForm,
  type UseFormReturn,
  useFormState,
  useWatch,
  Watch,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

/** 이름·이메일, 비밀번호·확인은 칸이 하나씩 늘어나는 한 화면이라 같은 렌더러로 이어 그린다 */
type SignUpStepContexts = {
  name: Record<string, never>;
  email: Record<string, never>;
  password: Record<string, never>;
  passwordConfirm: Record<string, never>;
  verification: { email: string };
};

type SignUpStep = keyof SignUpStepContexts;
type UserInfoStepName = 'name' | 'email';
type PasswordStepName = 'password' | 'passwordConfirm';
type SignUpForm = UseFormReturn<SignUpFormValues>;

/** iOS는 글자 버튼, Android 툴바는 글자를 그리지 않아 아이콘을 쓴다 */
const INVITE_CODE_ICON = process.env.EXPO_OS === 'ios' ? undefined : ConfirmationNumber;

const SIGN_UP_STEP_TITLE_KEYS = {
  name: 'auth:signUp.title',
  email: 'auth:signUp.title',
  password: 'auth:signUp.passwordStepTitle',
  passwordConfirm: 'auth:signUp.passwordStepTitle',
  verification: 'auth:signUp.verificationStepTitle',
} as const satisfies Record<SignUpStep, string>;

/** 입력 단계의 이름은 그 단계에서 새로 여는 칸 이름과 같다 */
const FIELD_STEPS = [
  'name',
  'email',
  'password',
  'passwordConfirm',
] as const satisfies readonly (SignUpStep & keyof SignUpFormValues)[];

const AGREEMENT_SET_VALUE_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

export default function SignUpScreen() {
  const { t } = useTranslation(['auth', 'invite']);
  const { trackEvent } = useTrack();
  const router = useRouter();
  const openInviteCodeEntry = useSingleTap(() => router.push('/invite'));
  const stepper = useStepper<SignUpStepContexts>({
    id: 'sign-up',
    initial: { step: 'name' },
    onStepChange: ({ step }) => trackEvent('auth_signup_step_viewed', { step }),
  });
  // 앞 단계로 돌아가도 입력값은 폼이 지킨다. 칸은 단계 컴포넌트가 구독해 글자를 쳐도 여기는 다시 그려지지 않는다
  const form = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: '',
      termsAgreed: false,
      privacyAgreed: false,
      isMarketingAgreed: false,
      password: '',
      passwordConfirm: '',
      name: '',
    },
    // 단계 버튼이 칸의 유효성을 바로 따르도록 입력마다 검사한다. 오류 문구는 칸을 벗어난 뒤에 보인다
    mode: 'onChange',
  });
  const signUp = useMutation(useRegisterMutationOptions());

  const isUserInfoStep = stepper.step === 'name' || stepper.step === 'email';

  const submitSignUp = form.handleSubmit(async ({ termsAgreed, privacyAgreed, ...values }) => {
    // 스키마가 이미 막았다. 요청 타입이 true만 받아 여기서 좁힌다
    if (!termsAgreed || !privacyAgreed) {
      return;
    }
    await signUp.mutateAsync(toRegisterRequest({ ...values, termsAgreed, privacyAgreed }));
    stepper.history.replace('verification', { email: values.email });
  });

  // 단계 버튼이 앞 칸을 이미 막았다. 그 사이 값이 바뀌었으면 틀린 칸의 단계로 돌아간다
  const recheckStepsAndSubmitSignUp = async () => {
    await form.trigger(FIELD_STEPS);
    const invalidStep = FIELD_STEPS.find((step) => form.getFieldState(step).invalid);
    if (invalidStep != null) {
      stepper.history.backTo(invalidStep);
      return;
    }
    // 실패 안내는 mutation이 한다. 시트를 열어 둬 바로 다시 누를 수 있다
    await submitSignUp().catch(noop);
  };
  // 칸을 다시 검사하는 동안 제출 중 표시가 켜지지 않아, 그 사이 두 번째 탭을 여기서 막는다
  const handleSignUpPress = useSingleTap(() => {
    recheckStepsAndSubmitSignUp();
  });

  const renderUserInfo = ({ step }: { step: UserInfoStepName }) => (
    <UserInfoStep
      form={form}
      step={step}
      onNext={() => stepper.history.push(step === 'name' ? 'email' : 'password')}
    />
  );

  const renderPassword = ({ step }: { step: PasswordStepName }) => (
    <PasswordStep
      form={form}
      step={step}
      onNext={() => stepper.history.push('passwordConfirm')}
      onSubmit={handleSignUpPress}
    />
  );

  return (
    <Box className="flex-1 bg-white">
      <Stack.Screen options={{ title: t(SIGN_UP_STEP_TITLE_KEYS[stepper.step]) }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          hidden={!isUserInfoStep}
          icon={INVITE_CODE_ICON}
          accessibilityLabel={t('invite:entry.haveInviteCode')}
          onPress={openInviteCodeEntry}
        >
          {t('invite:entry.inviteCodeShort')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <ReadableContent flex={1}>
        <stepper.Render
          name={renderUserInfo}
          email={renderUserInfo}
          password={renderPassword}
          passwordConfirm={renderPassword}
          verification={({ context: { email } }) => <VerificationStep email={email} />}
        />
      </ReadableContent>
    </Box>
  );
}

const USER_INFO_STEP_TITLE_KEYS = {
  name: 'auth:signUp.nameTitle',
  email: 'auth:signUp.emailTitle',
} as const satisfies Record<UserInfoStepName, string>;

interface UserInfoStepProps {
  form: SignUpForm;
  /** 이름 단계 다음 이메일 단계는 이름 칸 위에 이메일 칸을 더한다 */
  step: UserInfoStepName;
  onNext: () => void;
}

function UserInfoStep({ form, step, onNext }: UserInfoStepProps) {
  const { t } = useTranslation(['auth']);
  const { control } = form;
  const formState = useFormState({ control, name: ['name', 'email'] });

  useFocusOnStepBack({ step, firstStep: 'name', focus: () => form.setFocus('name') });

  const nameField = form.getFieldState('name', formState);
  const emailField = form.getFieldState('email', formState);
  const isNameReady = nameField.isDirty && !nameField.invalid;
  const isNextEnabled = match(step)
    .with('name', () => isNameReady)
    .with('email', () => isNameReady && emailField.isDirty && !emailField.invalid)
    .exhaustive();

  const openNextStep = () => {
    if (isNextEnabled) {
      onNext();
    }
  };

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={t(USER_INFO_STEP_TITLE_KEYS[step])}
        footer={
          <KeyboardAdaptiveButton color="dark" onPress={openNextStep} isDisabled={!isNextEnabled}>
            {t('auth:signUp.next')}
          </KeyboardAdaptiveButton>
        }
      >
        {step === 'email' && (
          <RevealedField onRevealed={() => form.setFocus('email')}>
            <Controller
              control={control}
              name="email"
              render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
                const error = fieldState.isTouched ? fieldState.error : undefined;
                return (
                  <VStack gap={8}>
                    <Input
                      ref={ref}
                      label={t('auth:signUp.emailLabel')}
                      placeholder={t('auth:signUp.emailPlaceholder')}
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect={false}
                      submitBehavior="submit"
                      returnKeyType="next"
                      isInvalid={error != null}
                      errorMessage={resolveValidationMessage(error, {
                        default: 'email.invalid',
                        byType: { too_big: 'email.tooLong' },
                      })}
                      onSubmitEditing={openNextStep}
                    />
                    <SuggestedEmailDomainList value={value} onChange={onChange} />
                  </VStack>
                );
              }}
            />
            <Spacing size={20} />
          </RevealedField>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
          <Controller
            control={control}
            name="name"
            render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
              const error = fieldState.isTouched ? fieldState.error : undefined;
              return (
                <Input
                  ref={ref}
                  label={t('auth:signUp.nicknameLabel')}
                  placeholder={t('auth:signUp.nicknamePlaceholder')}
                  value={value}
                  onChange={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  submitBehavior="submit"
                  autoFocus={step === 'name'}
                  returnKeyType="next"
                  isInvalid={error != null}
                  errorMessage={resolveValidationMessage(error, {
                    default: 'nickname.required',
                    byType: { too_big: 'nickname.tooLong' },
                  })}
                  onSubmitEditing={openNextStep}
                />
              );
            }}
          />
        </Animated.View>
      </FormStepLayout>
    </Box>
  );
}

interface PasswordStepProps {
  form: SignUpForm;
  /** 비밀번호 단계 다음 확인 단계는 비밀번호 칸 위에 확인 칸을 더한다 */
  step: PasswordStepName;
  onNext: () => void;
  /** 약관에 동의하고 시작을 누르면 가입을 보낸다 */
  onSubmit: () => void;
}

function PasswordStep({ form, step, onNext, onSubmit }: PasswordStepProps) {
  const dismissKeyboard = useDismissKeyboard();
  const { t } = useTranslation('auth');
  const { control } = form;
  const formState = useFormState({ control, name: ['password', 'passwordConfirm'] });
  const passwordValue = useWatch({ control, name: 'password' });

  const [isTermsOpen, setIsTermsOpen] = useState(false);

  useFocusOnStepBack({ step, firstStep: 'password', focus: () => form.setFocus('password') });

  const passwordField = form.getFieldState('password', formState);
  const passwordConfirmField = form.getFieldState('passwordConfirm', formState);
  const isPasswordReady = passwordField.isDirty && !passwordField.invalid;
  const isNextEnabled = match(step)
    .with('password', () => isPasswordReady)
    .with(
      'passwordConfirm',
      () => isPasswordReady && passwordConfirmField.isDirty && !passwordConfirmField.invalid,
    )
    .exhaustive();

  const openNextStepOrTerms = () => {
    if (!isNextEnabled) {
      return;
    }
    match(step)
      .with('password', onNext)
      .with('passwordConfirm', () => {
        dismissKeyboard();
        setIsTermsOpen(true);
      })
      .exhaustive();
  };

  return (
    <>
      <Box className="flex-1">
        <FormStepLayout
          title={t('signUp.passwordTitle')}
          footer={
            <KeyboardAdaptiveButton
              color="dark"
              onPress={openNextStepOrTerms}
              isDisabled={!isNextEnabled}
              enabled={!isTermsOpen}
            >
              {t('signUp.next')}
            </KeyboardAdaptiveButton>
          }
        >
          {step === 'passwordConfirm' && (
            <RevealedField onRevealed={() => form.setFocus('passwordConfirm')}>
              <Controller
                control={control}
                name="passwordConfirm"
                render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
                  // 다음 버튼이 꺼진 이유를 칸을 벗어나기 전에 알린다(비밀번호 바꾸기·재설정 확인 칸과 같은 시점)
                  const error = fieldState.isDirty ? fieldState.error : undefined;
                  return (
                    <PasswordInput
                      ref={ref}
                      label={t('signUp.passwordConfirmLabel')}
                      placeholder={t('signUp.passwordConfirmPlaceholder')}
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      returnKeyType="done"
                      isInvalid={error != null}
                      errorMessage={resolveValidationMessage(error, {
                        default: 'password.mismatch',
                      })}
                      onSubmitEditing={openNextStepOrTerms}
                    />
                  );
                }}
              />
              <Spacing size={20} />
            </RevealedField>
          )}

          <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
            <Controller
              control={control}
              name="password"
              // 비밀번호를 고치면 이미 적은 확인 칸의 일치 여부도 다시 본다
              rules={{ deps: 'passwordConfirm' }}
              render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
                const error = fieldState.isTouched ? fieldState.error : undefined;
                return (
                  <VStack gap={8}>
                    <PasswordInput
                      ref={ref}
                      label={t('signUp.passwordLabel')}
                      placeholder={t('signUp.passwordPlaceholder')}
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      autoFocus={step === 'password'}
                      submitBehavior="submit"
                      returnKeyType="next"
                      isInvalid={error != null}
                      renderErrorMessage={false}
                      onSubmitEditing={openNextStepOrTerms}
                    />

                    <PasswordStrengthIndicator password={passwordValue} />
                  </VStack>
                );
              }}
            />
          </Animated.View>
        </FormStepLayout>
      </Box>

      {/* 동의 칸과 시작 버튼만 그 값을 구독해 시트를 누를 때 비밀번호 단계는 다시 그려지지 않는다 */}
      <Watch
        control={control}
        name={['termsAgreed', 'privacyAgreed', 'isMarketingAgreed']}
        render={([termsAgreed, privacyAgreed, isMarketingAgreed]) => (
          <FormState
            control={control}
            render={({ isValid, isSubmitting }) => (
              <TermsAgreementBottomSheet
                isOpen={isTermsOpen}
                onOpenChange={setIsTermsOpen}
                value={{ termsAgreed, privacyAgreed, isMarketingAgreed }}
                onChange={(value) => {
                  form.setValue('termsAgreed', value.termsAgreed, AGREEMENT_SET_VALUE_OPTIONS);
                  form.setValue('privacyAgreed', value.privacyAgreed, AGREEMENT_SET_VALUE_OPTIONS);
                  form.setValue(
                    'isMarketingAgreed',
                    value.isMarketingAgreed,
                    AGREEMENT_SET_VALUE_OPTIONS,
                  );
                }}
                isSubmitDisabled={!isValid}
                isSubmitting={isSubmitting}
                onSubmit={onSubmit}
              />
            )}
          />
        )}
      />
    </>
  );
}

interface VerificationStepProps {
  email: string;
}

function VerificationStep({ email }: VerificationStepProps) {
  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  return (
    <EmailVerificationCodeStep
      email={email}
      isVerifying={verify.isPending}
      isResending={resend.isPending}
      onComplete={(code) => verify.mutateAsync({ email, code, source: 'sign_up' })}
      onResend={() => resend.mutateAsync({ email, source: 'sign_up' })}
    />
  );
}
