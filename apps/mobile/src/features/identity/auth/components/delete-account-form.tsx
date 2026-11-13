import { zodResolver } from '@hookform/resolvers/zod';
import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Box, FormStepLayout, KeyboardAdaptiveButton, useConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { findPasswordFieldError, PASSWORD_MISMATCH_FIELD_ERROR } from '../domains/auth.error';
import { useDeleteAccountMutationOptions } from '../queries/auth.mutations';
import { deleteAccountFormSchema } from '../schemas/delete-account-form.schema';
import { PasswordInput } from './password-input';

interface DeleteAccountFormProps {
  title: string;
  footer: ReactNode;
}

export function DeleteAccountForm({ title, footer }: DeleteAccountFormProps) {
  const { t } = useTranslation(['auth', 'common']);
  const deleteAccountMutation = useMutation(useDeleteAccountMutationOptions());
  const confirmDialog = useConfirmDialog();
  const form = useForm({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { password: '' },
    mode: 'onChange',
  });
  const { isValid } = useFormState({ control: form.control });

  const handleDeletePress = form.handleSubmit(async ({ password }) => {
    Keyboard.dismiss();
    await confirmDialog.openAsync({
      title: t('deleteAccount.dialogTitle'),
      description: t('deleteAccount.dialogMessage'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('deleteAccount.confirm'),
      confirmColor: 'danger',
      onConfirm: async () => {
        try {
          await deleteAccountMutation.mutateAsync({ password });
        } catch (error) {
          // 비밀번호가 틀리면 다시 눌러도 같아 다이얼로그를 닫고 그 칸에 보인다. 그 밖의 실패는 다이얼로그를 남기고 안내는 meta.errorFeedback이 맡는다
          const fieldError = findPasswordFieldError(error);
          if (fieldError == null) {
            throw error;
          }
          form.setError('password', fieldError);
        }
      },
    });
    if (form.getFieldState('password').error != null) {
      form.setFocus('password');
    }
  });

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={title}
        footer={
          <KeyboardAdaptiveButton
            color="danger"
            onPress={() => handleDeletePress()}
            isDisabled={!isValid}
            isLoading={deleteAccountMutation.isPending}
          >
            {t('deleteAccount.submit')}
          </KeyboardAdaptiveButton>
        }
      >
        <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
          <Controller
            control={form.control}
            name="password"
            render={({ field: { ref, onChange, value }, fieldState: { error } }) => (
              <PasswordInput
                ref={ref}
                label={t('deleteAccount.currentPasswordLabel')}
                placeholder={t('deleteAccount.passwordPlaceholder')}
                value={value}
                onChange={onChange}
                textContentType="password"
                autoComplete="password"
                autoFocus
                submitBehavior="submit"
                returnKeyType="done"
                isInvalid={error != null}
                errorMessage={resolveValidationMessage(error, {
                  default: 'password.required',
                  byType: { [PASSWORD_MISMATCH_FIELD_ERROR.type]: 'password.mismatch' },
                })}
                onSubmitEditing={() => handleDeletePress()}
              />
            )}
          />
        </Animated.View>

        {footer}
      </FormStepLayout>
    </Box>
  );
}
