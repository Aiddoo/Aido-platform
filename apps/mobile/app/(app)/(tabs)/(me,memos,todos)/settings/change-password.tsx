import { zodResolver } from '@hookform/resolvers/zod';
import { NewPasswordStep } from '@src/features/identity/auth/components/new-password-step';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import {
  findPasswordFieldError,
  PASSWORD_MISMATCH_FIELD_ERROR,
} from '@src/features/identity/auth/domains/auth.error';
import { useChangePasswordMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from '@src/features/identity/auth/schemas/change-password-form.schema';
import { ANIMATION } from '@src/shared/constants/animation';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, FormStepLayout, KeyboardAdaptiveButton, ReadableContent } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Stack, useNavigation } from 'expo-router';
import {
  Controller,
  useController,
  useForm,
  type UseFormReturn,
  useFormState,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

type ChangePasswordStepContexts = {
  currentPassword: Record<string, never>;
  newPassword: Record<string, never>;
  newPasswordConfirm: Record<string, never>;
};

type NewPasswordStepName = 'newPassword' | 'newPasswordConfirm';
type ChangePasswordForm = UseFormReturn<ChangePasswordFormValues>;

/** 현재 비밀번호가 틀리면 그 칸으로 돌아가 보이고, 그 밖의 실패는 토스트로 알린다. 입력값은 그대로 둔다 */
export default function ChangePasswordScreen() {
  const { t } = useTranslation('settings');
  const navigation = useNavigation();
  const goBack = useGoBack({ fallbackHref: '/settings/profile' });
  const stepper = useStepper<ChangePasswordStepContexts>({
    id: 'change-password',
    initial: { step: 'currentPassword' },
  });
  // 칸은 단계 컴포넌트가 구독해 글자를 쳐도 여기는 다시 그려지지 않는다
  const form = useForm({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
    mode: 'onChange',
  });

  // 바꾸는 동안 밀어서 떠났으면 지금 화면이 이전 화면이라 또 닫지 않는다.
  // 남은 폼을 다시 보내면 옛 현재 비밀번호라 거절되므로 비우고 첫 단계로 돌린다
  const leaveAfterChange = () => {
    if (navigation.isFocused()) {
      goBack();
      return;
    }
    form.reset();
    stepper.history.backTo('currentPassword');
  };

  const renderNewPassword = ({ step }: { step: NewPasswordStepName }) => (
    <ChangePasswordStep
      form={form}
      step={step}
      onNext={() => stepper.history.push('newPasswordConfirm')}
      onDone={leaveAfterChange}
      onCurrentPasswordRejected={() => stepper.history.backTo('currentPassword')}
    />
  );

  return (
    <>
      <Stack.Screen options={{ title: t('titles.changePassword') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <stepper.Render
            currentPassword={({ history }) => (
              <CurrentPasswordStep form={form} onNext={() => history.push('newPassword')} />
            )}
            newPassword={renderNewPassword}
            newPasswordConfirm={renderNewPassword}
          />
        </ReadableContent>
      </Box>
    </>
  );
}

interface CurrentPasswordStepProps {
  form: ChangePasswordForm;
  onNext: () => void;
}

function CurrentPasswordStep({ form, onNext }: CurrentPasswordStepProps) {
  const { t } = useTranslation('auth');
  const { control } = form;
  const formState = useFormState({ control, name: 'currentPassword' });
  const currentPassword = form.getFieldState('currentPassword', formState);
  const isValid = currentPassword.isDirty && !currentPassword.invalid;

  const handleNext = async () => {
    const isCurrentPasswordValid = await form.trigger(['currentPassword']);
    if (isCurrentPasswordValid) {
      onNext();
    }
  };

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={t('changePassword.currentTitle')}
        footer={
          <KeyboardAdaptiveButton onPress={handleNext} isDisabled={!isValid}>
            {t('changePassword.next')}
          </KeyboardAdaptiveButton>
        }
      >
        <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { ref, onChange, value }, fieldState: { error } }) => (
              <PasswordInput
                ref={ref}
                label={t('changePassword.currentLabel')}
                placeholder={t('changePassword.currentPlaceholder')}
                value={value}
                onChange={onChange}
                textContentType="password"
                autoComplete="password"
                autoFocus
                submitBehavior="submit"
                returnKeyType="next"
                isInvalid={error != null}
                errorMessage={resolveValidationMessage(error, {
                  default: 'currentPassword.required',
                  byType: { [PASSWORD_MISMATCH_FIELD_ERROR.type]: 'currentPassword.mismatch' },
                })}
                onSubmitEditing={() => {
                  if (isValid) {
                    handleNext();
                  }
                }}
              />
            )}
          />
        </Animated.View>
      </FormStepLayout>
    </Box>
  );
}

interface ChangePasswordStepProps {
  form: ChangePasswordForm;
  /** 새 비밀번호 단계 다음 확인 단계는 새 비밀번호 칸 위에 확인 칸을 더한다 */
  step: NewPasswordStepName;
  onNext: () => void;
  onDone: () => void;
  onCurrentPasswordRejected: () => void;
}

function ChangePasswordStep({
  form,
  step,
  onNext,
  onDone,
  onCurrentPasswordRejected,
}: ChangePasswordStepProps) {
  const { t } = useTranslation('auth');
  const changePassword = useMutation(useChangePasswordMutationOptions());
  const newPassword = useController({
    control: form.control,
    name: 'newPassword',
    // 새 비밀번호를 고치면 이미 적은 확인 칸의 일치 여부도 다시 본다
    rules: { deps: 'newPasswordConfirm' },
  });
  const newPasswordConfirm = useController({ control: form.control, name: 'newPasswordConfirm' });
  const { isSubmitting, isSubmitSuccessful } = useFormState({ control: form.control });

  const savePassword = form.handleSubmit(async (input) => {
    await changePassword.mutateAsync(input);
    onDone();
  });

  // 그 밖의 실패 안내는 mutation의 meta.errorFeedback이 맡는다
  const handleChangeError = (error: unknown) => {
    const fieldError = findPasswordFieldError(error);
    if (fieldError != null) {
      form.setError('currentPassword', fieldError);
      onCurrentPasswordRejected();
    }
  };
  // 같은 프레임의 두 번째 탭은 isSubmitting이 다음 렌더에야 켜져 여기서 막는다
  const handleSavePress = useSingleTap(() => {
    savePassword().catch(handleChangeError);
  });

  return (
    <NewPasswordStep
      title={t('forgotPassword.newPasswordTitle')}
      step={step}
      newPassword={{
        value: newPassword.field.value,
        onChange: newPassword.field.onChange,
        isDirty: newPassword.fieldState.isDirty,
        isInvalid: newPassword.fieldState.invalid,
      }}
      newPasswordConfirm={{
        value: newPasswordConfirm.field.value,
        onChange: newPasswordConfirm.field.onChange,
        isDirty: newPasswordConfirm.fieldState.isDirty,
        isInvalid: newPasswordConfirm.fieldState.invalid,
        errorMessage: resolveValidationMessage(newPasswordConfirm.fieldState.error, {
          default: 'password.mismatch',
        }),
      }}
      // 바꾸면 화면이 내려가는 동안에도 같은 값이 남는다. 다시 보내면 옛 현재 비밀번호라 거절된다
      isSubmitting={isSubmitting || isSubmitSuccessful || changePassword.isPending}
      onNext={onNext}
      onSubmit={handleSavePress}
      nextLabel={t('changePassword.next')}
      submitLabel={t('changePassword.submit')}
    />
  );
}
