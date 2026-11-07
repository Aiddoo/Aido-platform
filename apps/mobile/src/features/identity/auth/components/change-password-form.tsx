import { zodResolver } from '@hookform/resolvers/zod';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
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
  useWatch,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useChangePasswordMutationOptions } from '../queries/auth.mutations';
import {
  changePasswordFormSchema,
  type ChangePasswordFormInput,
} from '../schemas/change-password-form.schema';
import { NewPasswordStep } from './new-password-step';
import { PasswordInput } from './password-input';

type ChangePasswordStepContexts = {
  currentPassword: Record<string, never>;
  newPassword: Record<string, never>;
};

/** 비밀번호 변경 2단계(현재 비밀번호, 새 비밀번호)의 입력과 제출. 실패하면 토스트로 알리고 입력값은 그대로 둔다 */
export function ChangePasswordForm() {
  const form = useForm({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
    mode: 'onChange',
  });
  const stepper = useStepper<ChangePasswordStepContexts>({
    id: 'change-password',
    initial: { step: 'currentPassword', context: {} },
  });
  const reportUnexpectedError = useReportUnexpectedError('auth');
  const changePassword = useMutation(useChangePasswordMutationOptions());
  const { t } = useTranslation('auth');
  const newPassword = useController({ control: form.control, name: 'newPassword' });
  const newPasswordConfirm = useController({ control: form.control, name: 'newPasswordConfirm' });
  const { isSubmitting } = useFormState({ control: form.control });

  const submitNewPassword = form.handleSubmit(async (input) => {
    try {
      await changePassword.mutateAsync(input);
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  const handleNextStep = async () => {
    const isValid = await form.trigger(['currentPassword']);
    if (isValid) {
      stepper.history.push('newPassword', {});
    }
  };

  return stepper.Render({
    currentPassword: () => <CurrentPasswordStep form={form} onNext={handleNextStep} />,
    newPassword: () => (
      <NewPasswordStep
        newPassword={newPassword}
        newPasswordConfirm={newPasswordConfirm}
        isSubmitting={isSubmitting}
        onSubmit={submitNewPassword}
        nextLabel={t('changePassword.next')}
        submitLabel={t('changePassword.submit')}
      />
    ),
  });
}

interface CurrentPasswordStepProps {
  form: UseFormReturn<ChangePasswordFormInput>;
  onNext: () => void;
}

function CurrentPasswordStep({ form, onNext }: CurrentPasswordStepProps) {
  const { t } = useTranslation('auth');
  const { control } = form;
  const { errors } = useFormState({ control, name: 'currentPassword' });
  const currentPassword = useWatch({ control, name: 'currentPassword' });
  const isValid = currentPassword.length > 0 && !errors.currentPassword;

  return (
    <Box className="flex-1">
      <FormStepLayout title={t('changePassword.currentTitle')}>
        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { onChange, value }, fieldState: { error } }) => (
              <PasswordInput
                label={t('changePassword.currentLabel')}
                placeholder={t('changePassword.currentPlaceholder')}
                value={value}
                onChange={onChange}
                textContentType="password"
                autoComplete="password"
                autoFocus
                submitBehavior="submit"
                returnKeyType="next"
                isInvalid={!!error}
                errorMessage={resolveValidationMessage(error, {
                  default: 'currentPassword.required',
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

      <KeyboardAdaptiveButton onPress={onNext} isDisabled={!isValid}>
        {t('changePassword.next')}
      </KeyboardAdaptiveButton>
    </Box>
  );
}
