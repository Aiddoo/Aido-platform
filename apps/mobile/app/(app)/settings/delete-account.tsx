import { deleteAccountSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/auth/components/password-input';
import { useDeleteAccountMutationOptions } from '@src/features/auth/queries/use-delete-account-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useTranslation } from '@src/shared/i18n';
import {
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  Text,
  useConfirmDialog,
  VStack,
  FormStepLayout,
  Box,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { Suspense } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const credentialDeleteAccountSchema = deleteAccountSchema.required({ password: true });

function DeleteAccountScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const deleteAccountMutation = useMutation(useDeleteAccountMutationOptions());
  const confirmDialog = useConfirmDialog();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(credentialDeleteAccountSchema),
    defaultValues: { password: '' },
    mode: 'onChange',
  });
  const { isValid } = useFormState({ control });

  const handleDeletePress = handleSubmit(async ({ password }) => {
    Keyboard.dismiss();
    const isConfirmed = await confirmDialog.open({
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
      <FormStepLayout title={t('deleteAccount.passwordTitle')}>
        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <FormField control={control} name="password">
            {({ onChange, value }) => (
              <PasswordInput
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
          </FormField>
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(ANIMATION.duration.normal).delay(ANIMATION.delay.short)}
        >
          <VStack mt={16} p={16} gap={4} className="bg-warning-1 rounded-xl">
            <Text size="b3" shade={7}>
              {t('deleteAccount.restoreNotice')}
            </Text>
            <Text size="b3" shade={5}>
              {t('deleteAccount.purgeNotice')}
            </Text>
          </VStack>
        </Animated.View>
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

export default function DeleteAccountRoute() {
  return (
    <Box className="flex-1 bg-gray-1">
      <QueryErrorBoundary>
        <Suspense fallback={<Box className="flex-1" />}>
          <DeleteAccountScreen />
        </Suspense>
      </QueryErrorBoundary>
    </Box>
  );
}
