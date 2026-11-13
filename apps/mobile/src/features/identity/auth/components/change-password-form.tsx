import { zodResolver } from '@hookform/resolvers/zod';
import { ANIMATION } from '@src/shared/constants/animation';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, FormStepLayout, KeyboardAdaptiveButton } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import {
  Controller,
  useController,
  useForm,
  type UseFormReturn,
  useFormState,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

import { findPasswordFieldError, PASSWORD_MISMATCH_FIELD_ERROR } from '../domains/auth.error';
import { useChangePasswordMutationOptions } from '../queries/auth.mutations';
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from '../schemas/change-password-form.schema';
import { NewPasswordStep } from './new-password-step';
import { PasswordInput } from './password-input';

type ChangePasswordStepContexts = {
  currentPassword: Record<string, never>;
  newPassword: Record<string, never>;
  newPasswordConfirm: Record<string, never>;
};

interface ChangePasswordFormProps {
  stepTitles: Record<'currentPassword' | 'newPassword', string>;
}

/** 현재 비밀번호가 틀리면 그 칸으로 돌아가 보이고, 그 밖의 실패는 토스트로 알린다. 입력값은 그대로 둔다 */
export function ChangePasswordForm({ stepTitles }: ChangePasswordFormProps) {
  const form = useForm({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
    mode: 'onChange',
  });
  const stepper = useStepper<ChangePasswordStepContexts>({
    id: 'change-password',
    initial: { step: 'currentPassword' },
  });
  const { t } = useTranslation('auth');
  const changePassword = useMutation(useChangePasswordMutationOptions());
  const newPassword = useController({
    control: form.control,
    name: 'newPassword',
    // 새 비밀번호를 고치면 이미 적은 확인 칸의 일치 여부도 다시 본다
    rules: { deps: 'newPasswordConfirm' },
  });
  const newPasswordConfirm = useController({ control: form.control, name: 'newPasswordConfirm' });
  const { isSubmitting } = useFormState({ control: form.control });
  const goBack = useGoBack({ fallbackHref: '/settings/profile' });

  const submitNewPassword = form.handleSubmit(async (input) => {
    try {
      await changePassword.mutateAsync(input);
      goBack();
    } catch (error) {
      // 그 밖의 실패 안내는 mutation의 meta.errorFeedback이 맡는다
      const fieldError = findPasswordFieldError(error);
      if (fieldError != null) {
        form.setError('currentPassword', fieldError);
        stepper.history.go(-stepper.index);
      }
    }
  });

  const handleNextStep = async () => {
    const isValid = await form.trigger(['currentPassword']);
    if (isValid) {
      stepper.history.push('newPassword');
    }
  };

  const renderNewPassword = ({ step }: { step: 'newPassword' | 'newPasswordConfirm' }) => (
    <NewPasswordStep
      title={stepTitles.newPassword}
      step={step}
      newPassword={newPassword}
      newPasswordConfirm={newPasswordConfirm}
      isSubmitting={isSubmitting || changePassword.isPending}
      onNextStep={() => stepper.history.push('newPasswordConfirm')}
      onSubmit={submitNewPassword}
      nextLabel={t('changePassword.next')}
      submitLabel={t('changePassword.submit')}
    />
  );

  return (
    <stepper.Render
      currentPassword={() => (
        <CurrentPasswordStep
          title={stepTitles.currentPassword}
          form={form}
          onNext={handleNextStep}
        />
      )}
      newPassword={renderNewPassword}
      newPasswordConfirm={renderNewPassword}
    />
  );
}

interface CurrentPasswordStepProps {
  title: string;
  form: UseFormReturn<ChangePasswordFormValues>;
  onNext: () => void;
}

function CurrentPasswordStep({ title, form, onNext }: CurrentPasswordStepProps) {
  const { t } = useTranslation('auth');
  const { control } = form;
  const formState = useFormState({ control, name: 'currentPassword' });
  const currentPassword = form.getFieldState('currentPassword', formState);
  const isValid = currentPassword.isDirty && !currentPassword.invalid;

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={title}
        footer={
          <KeyboardAdaptiveButton onPress={onNext} isDisabled={!isValid}>
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
                    onNext();
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
