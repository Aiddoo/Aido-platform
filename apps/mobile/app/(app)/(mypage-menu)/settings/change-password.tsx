import { type ChangePasswordInput, changePasswordSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { NewPasswordStep } from '@src/features/identity/auth/components/new-password-step';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import { useChangePasswordMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, FormStepLayout, KeyboardAdaptiveButton, ReadableContent } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import {
  useFormState,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
  Controller,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

type ChangePasswordStepContexts = {
  currentPassword: Record<string, never>;
  newPassword: Record<string, never>;
};

export default function ChangePasswordScreen() {
  const form = useForm({
    resolver: zodResolver(changePasswordSchema),
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

  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <FormProvider {...form}>
          {stepper.Render({
            currentPassword: () => <CurrentPasswordStep onNext={handleNextStep} />,
            newPassword: () => (
              <NewPasswordStep
                onSubmit={submitNewPassword}
                nextLabel={t('changePassword.next')}
                submitLabel={t('changePassword.submit')}
              />
            ),
          })}
        </FormProvider>
      </ReadableContent>
    </Box>
  );
}

interface CurrentPasswordStepProps {
  onNext: () => void;
}

function CurrentPasswordStep({ onNext }: CurrentPasswordStepProps) {
  const { t } = useTranslation('auth');
  const { control } = useFormContext<ChangePasswordInput>();
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
