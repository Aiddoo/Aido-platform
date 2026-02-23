import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { deleteAccountMutationOptions } from '@src/features/auth/presentations/queries/delete-account-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { KeyboardAdaptiveButton } from '@src/shared/ui/Button';
import { ConfirmDialog } from '@src/shared/ui/ConfirmDialog';
import { useOverlay } from '@src/shared/ui/Overlay';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Text } from '@src/shared/ui/Text/Text';
import { H3 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
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
  const [password, setPassword] = useState('');
  const deleteAccountMutation = useMutation(deleteAccountMutationOptions());
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
        title={<ConfirmDialog.Title>회원 탈퇴</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            {'정말 탈퇴하시겠어요?\n30일 이내에 복구할 수 있어요.'}
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton
            onPress={() => {
              close();
              exit();
            }}
          >
            취소
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
            탈퇴하기
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
          <H3>{'탈퇴를 위해\n비밀번호를 입력해주세요'}</H3>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <PasswordInput
            label="현재 비밀번호"
            placeholder="비밀번호를 입력해주세요"
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
              탈퇴 후 30일 이내에 다시 로그인하면 계정을 복구할 수 있어요.
            </Text>
            <Text size="b3" shade={5}>
              30일이 지나면 모든 데이터가 영구적으로 삭제돼요.
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
        탈퇴하기
      </KeyboardAdaptiveButton>
    </View>
  );
}
