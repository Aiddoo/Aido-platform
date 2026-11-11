import { zodResolver } from '@hookform/resolvers/zod';
import { ANIMATION } from '@src/shared/constants/animation';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, FormStepLayout, KeyboardAdaptiveButton } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
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
  type ChangePasswordFormValues,
} from '../schemas/change-password-form.schema';
import { NewPasswordStep } from './new-password-step';
import { PasswordInput } from './password-input';

type ChangePasswordStepContexts = {
  currentPassword: Record<string, never>;
  newPassword: Record<string, never>;
};

interface ChangePasswordFormProps {
  stepTitles: Record<keyof ChangePasswordStepContexts, string>;
}

/** 실패하면 토스트로 알리고 입력값은 그대로 둔다 */
export function ChangePasswordForm({ stepTitles }: ChangePasswordFormProps) {
  const form = useForm({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
    mode: 'onChange',
  });
  const stepper = useStepper<ChangePasswordStepContexts>({
    id: 'change-password',
    initial: { step: 'currentPassword', context: {} },
  });
  const changePassword = useMutation(useChangePasswordMutationOptions());
  const { t } = useTranslation('auth');
  const newPassword = useController({ control: form.control, name: 'newPassword' });
  const newPasswordConfirm = useController({ control: form.control, name: 'newPasswordConfirm' });
  const { isSubmitting } = useFormState({ control: form.control });

  const submitNewPassword = form.handleSubmit(async (input) => {
    await changePassword.mutateAsync(input).catch(noop);
  });

  const handleNextStep = async () => {
    const isValid = await form.trigger(['currentPassword']);
    if (isValid) {
      stepper.history.push('newPassword', {});
    }
  };

  return (
    <stepper.Render
      currentPassword={() => (
        <CurrentPasswordStep
          title={stepTitles.currentPassword}
          form={form}
          onNext={handleNextStep}
        />
      )}
      newPassword={() => (
        <NewPasswordStep
          title={stepTitles.newPassword}
          newPassword={newPassword}
          newPasswordConfirm={newPasswordConfirm}
          isSubmitting={isSubmitting}
          onSubmit={submitNewPassword}
          nextLabel={t('changePassword.next')}
          submitLabel={t('changePassword.submit')}
        />
      )}
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
  const { errors } = useFormState({ control, name: 'currentPassword' });
  const currentPassword = useWatch({ control, name: 'currentPassword' });
  const isValid = currentPassword.length > 0 && !errors.currentPassword;

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
        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
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
    </Box>
  );
}
