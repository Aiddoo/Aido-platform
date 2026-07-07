import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { useDeleteAccountMutationOptions } from '@src/features/auth/presentations/queries/use-delete-account-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useTranslation } from '@src/shared/i18n';
import {
  ConfirmDialog,
  H3,
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  Text,
  useOverlay,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const DeleteAccountScreen = () => {
  return (
    <View className="flex-1 bg-gray-1">
      <QueryErrorBoundary>
        <Suspense fallback={<View className="flex-1" />}>
          <DeleteAccountForm />
        </Suspense>
      </QueryErrorBoundary>
    </View>
  );
};

export default DeleteAccountScreen;

function DeleteAccountForm() {
  const { t } = useTranslation(['auth', 'common']);
  const [password, setPassword] = useState('');
  const deleteAccountMutation = useMutation(useDeleteAccountMutationOptions());
  const overlay = useOverlay();

  const isValid = password.length > 0;

  const handleDeletePress = () => {
    Keyboard.dismiss();
    overlay.open(({ isOpen, close, exit }) => (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            exit();
          }
        }}
        title={<ConfirmDialog.Title>{t('deleteAccount.dialogTitle')}</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>{t('deleteAccount.dialogMessage')}</ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton
            onPress={() => {
              close();
              exit();
            }}
          >
            {t('common:actions.cancel')}
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton
            color="danger"
            onPress={() => {
              close();
              exit();
              deleteAccountMutation.mutate({ password });
            }}
          >
            {t('deleteAccount.confirm')}
          </ConfirmDialog.ConfirmButton>
        }
      />
    ));
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
            onChangeText={setPassword}
            autoFocus
            submitBehavior="submit"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (isValid) handleDeletePress();
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
