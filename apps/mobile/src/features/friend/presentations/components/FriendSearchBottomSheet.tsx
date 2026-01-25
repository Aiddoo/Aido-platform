import { userTagParamSchema } from '@aido/validators';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { SearchIcon } from '@src/shared/ui/Icon';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, useToast } from 'heroui-native';
import { useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { FriendError } from '../../models/friend.error';
import { sendRequestByTagMutationOptions } from '../queries/send-request-by-tag-mutation-options';

// TODO: react-hook-form으로 마이그레이션 예정
export const FriendSearchBottomSheet = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [userTag, setUserTag] = useState('');
  const sendRequestMutation = useMutation(sendRequestByTagMutationOptions());
  const { toast } = useToast();

  const validationResult = userTagParamSchema.safeParse({ userTag });

  const handleSubmit = () => {
    if (!validationResult.success) return;

    Keyboard.dismiss();

    sendRequestMutation.mutate(validationResult.data.userTag, {
      onSuccess: () => {
        toast.show({
          label: '친구 요청을 보냈어요',
          actionLabel: '닫기',
          onActionPress: ({ hide }) => hide(),
        });
        setUserTag('');
        setIsOpen(false);
      },
      onError: (error) => {
        const message = error instanceof FriendError ? error.message : '친구 요청에 실패했어요';
        toast.show({
          label: message,
          actionLabel: '닫기',
          onActionPress: ({ hide }) => hide(),
        });
      },
    });
  };

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
      <BottomSheet.Trigger asChild>
        <Pressable hitSlop={8} className="p-2">
          <SearchIcon width={20} height={20} colorClassName="text-gray-9" />
        </Pressable>
      </BottomSheet.Trigger>

      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          className="px-1"
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
        >
          <BottomSheet.Title>
            <Text size="b3" weight="medium">
              친구 요청을 보내보세요
            </Text>
          </BottomSheet.Title>
          <BottomSheet.Description>
            <Text size="b4" shade={6}>
              친구와 함께 할 일을 공유하고 콕 찔러줄 수 있어요
            </Text>
          </BottomSheet.Description>

          <Spacing size={12} />

          <View className="gap-4 pb-4">
            <HStack gap={8} align="center" className="w-full">
              <View className="flex-1 rounded-lg border border-gray-3 bg-white px-3 py-2">
                <BottomSheetTextInput
                  placeholder="친구태그 입력 (ABC12345)"
                  value={userTag}
                  onChangeText={setUserTag}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={8}
                  style={{ fontSize: 16 }}
                />
              </View>
              <Button
                display="inline"
                size="medium"
                onPress={handleSubmit}
                isLoading={sendRequestMutation.isPending}
                isDisabled={!validationResult.success}
              >
                친구 요청
              </Button>
            </HStack>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};
