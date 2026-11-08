import { zodResolver } from '@hookform/resolvers/zod';
import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { Box, FormStepLayout, KeyboardAdaptiveButton, useConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

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
    const isConfirmed = await confirmDialog.openAsync({
      title: t('deleteAccount.dialogTitle'),
      description: t('deleteAccount.dialogMessage'),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('deleteAccount.confirm'),
      confirmColor: 'danger',
    });
    if (isConfirmed) {
      deleteAccountMutation.mutate({ password });
    }
  });

  return (
    <Box className="flex-1">
      <FormStepLayout title={title}>
        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <Controller
            control={form.control}
            name="password"
            render={({ field: { ref, onChange, value } }) => (
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
                renderErrorMessage={false}
                onSubmitEditing={() => handleDeletePress()}
              />
            )}
          />
        </Animated.View>

        {footer}
      </FormStepLayout>

      <KeyboardAdaptiveButton
        color="danger"
        onPress={() => handleDeletePress()}
        isDisabled={!isValid}
        isLoading={deleteAccountMutation.isPending}
      >
        {t('deleteAccount.submit')}
      </KeyboardAdaptiveButton>
    </Box>
  );
}
