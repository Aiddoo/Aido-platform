import { deleteAccountSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import { useDeleteAccountMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  FormStepLayout,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  ReadableContent,
  useConfirmDialog,
  VStack,
  WordWrapText,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Suspense } from 'react';
import { useForm, useFormState, Controller } from 'react-hook-form';
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
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
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
          />
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(ANIMATION.duration.normal).delay(ANIMATION.delay.short)}
        >
          <VStack mt={16} p={16} gap={4} className="bg-warning-1 rounded-xl">
            <WordWrapText size="b3" shade={7}>
              {t('deleteAccount.restoreNotice')}
            </WordWrapText>
            <WordWrapText size="b3" shade={5}>
              {t('deleteAccount.purgeNotice')}
            </WordWrapText>
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
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <QueryErrorBoundary>
          <Suspense fallback={<Box className="flex-1" />}>
            <DeleteAccountScreen />
          </Suspense>
        </QueryErrorBoundary>
      </ReadableContent>
    </Box>
  );
}
