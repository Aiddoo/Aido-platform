import { PasswordInput } from '@src/features/auth/components/password-input';
import { useDeleteAccountMutationOptions } from '@src/features/auth/queries/use-delete-account-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useTranslation } from '@src/shared/i18n';
import {
  H3,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  Text,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

function DeleteAccountScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const [password, setPassword] = useState('');
  const deleteAccountMutation = useMutation(useDeleteAccountMutationOptions());
  const confirmDialog = useConfirmDialog();

  const isValid = password.length > 0;

  const handleDeletePress = async () => {
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
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeIn.duration(ANIMATION.duration.slow)}
          style={{ marginBottom: 24 }}
        >
          <H3>{t('deleteAccount.passwordTitle')}</H3>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <PasswordInput
            label={t('deleteAccount.currentPasswordLabel')}
            placeholder={t('deleteAccount.passwordPlaceholder')}
            value={password}
            onChange={setPassword}
            autoFocus
            submitBehavior="submit"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (isValid) {
                handleDeletePress();
              }
            }}
          />
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
      </ScrollView>

      <KeyboardAdaptiveButton
        color="danger"
        onPress={handleDeletePress}
        isDisabled={!isValid}
        isLoading={deleteAccountMutation.isPending}
      >
        {t('deleteAccount.submit')}
      </KeyboardAdaptiveButton>
    </View>
  );
}

export default function DeleteAccountRoute() {
  return (
    <View className="flex-1 bg-gray-1">
      <QueryErrorBoundary>
        <Suspense fallback={<View className="flex-1" />}>
          <DeleteAccountScreen />
        </Suspense>
      </QueryErrorBoundary>
    </View>
  );
}
