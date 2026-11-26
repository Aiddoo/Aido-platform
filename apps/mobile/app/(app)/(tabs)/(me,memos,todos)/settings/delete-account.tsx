import { ACCOUNT_DELETION } from '@aido/api/vocabulary';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/identity/auth/components/password-input';
import {
  findPasswordFieldError,
  PASSWORD_MISMATCH_FIELD_ERROR,
} from '@src/features/identity/auth/domains/auth.error';
import { useDeleteAccountMutationOptions } from '@src/features/identity/auth/queries/auth.mutations';
import { deleteAccountFormSchema } from '@src/features/identity/auth/schemas/delete-account-form.schema';
import { ANIMATION } from '@src/shared/constants/animation';
import { useDismissKeyboard } from '@src/shared/hooks/use-dismiss-keyboard';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Box,
  FormStepLayout,
  InlineAlert,
  KeyboardAdaptiveButton,
  ReadableContent,
  Spacing,
  useConfirmDialog,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Controller, FormState, useForm } from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function DeleteAccountScreen() {
  const { t } = useTranslation(['auth', 'settings', 'common']);
  const dismissKeyboard = useDismissKeyboard();
  const confirmDialog = useConfirmDialog();
  const deleteAccount = useMutation(useDeleteAccountMutationOptions());
  const form = useForm({
    resolver: zodResolver(deleteAccountFormSchema),
    defaultValues: { password: '' },
    mode: 'onChange',
  });

  const saveAccountDeletion = form.handleSubmit(async ({ password }) => {
    dismissKeyboard();
    await confirmDialog.openAsync({
      title: t('deleteAccount.dialogTitle'),
      description: t('deleteAccount.dialogMessage', { days: ACCOUNT_DELETION.GRACE_PERIOD_DAYS }),
      cancelLabel: t('common:actions.cancel'),
      confirmLabel: t('deleteAccount.confirm'),
      confirmColor: 'danger',
      onConfirm: async () => {
        try {
          await deleteAccount.mutateAsync({ password });
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
  // 같은 프레임에 두 번 누르면 확인 다이얼로그가 두 개 뜬다
  const handleDeletePress = useSingleTap(() => {
    saveAccountDeletion();
  });

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.deleteAccount') }} />

      <Box className="flex-1 bg-white">
        <ReadableContent flex={1}>
          <Box className="flex-1">
            <FormStepLayout
              title={t('deleteAccount.passwordTitle')}
              footer={
                <FormState
                  control={form.control}
                  render={({ isValid }) => (
                    <KeyboardAdaptiveButton
                      color="danger"
                      onPress={handleDeletePress}
                      isDisabled={!isValid}
                      isLoading={deleteAccount.isPending}
                    >
                      {t('deleteAccount.submit')}
                    </KeyboardAdaptiveButton>
                  )}
                />
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
                      onSubmitEditing={handleDeletePress}
                    />
                  )}
                />
              </Animated.View>

              <Animated.View
                entering={FadeIn.duration(ANIMATION.durationMs.normal).delay(
                  ANIMATION.delayMs.short,
                )}
              >
                <Spacing size={16} />
                <InlineAlert
                  status="warning"
                  title={t('deleteAccount.restoreNotice', {
                    days: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
                  })}
                  description={t('deleteAccount.purgeNotice', {
                    days: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
                  })}
                />
              </Animated.View>
            </FormStepLayout>
          </Box>
        </ReadableContent>
      </Box>
    </>
  );
}
