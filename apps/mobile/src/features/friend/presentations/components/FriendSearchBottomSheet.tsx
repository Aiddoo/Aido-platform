import { userTagParamSchema } from '@aido/validators';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@src/shared/ui/Button/Button';
import { Flex } from '@src/shared/ui/Flex/Flex';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { SearchIcon } from '@src/shared/ui/Icon';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, useToast } from 'heroui-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, Pressable } from 'react-native';
import type { z } from 'zod';
import { FriendError } from '../../models/friend.error';
import { sendRequestByTagMutationOptions } from '../queries/send-request-by-tag-mutation-options';

type FormData = z.infer<typeof userTagParamSchema>;

export const FriendSearchBottomSheet = () => {
  const [isOpen, setIsOpen] = useState(false);
  const sendRequestMutation = useMutation(sendRequestByTagMutationOptions());
  const { toast } = useToast();

  const { control, handleSubmit, reset, formState } = useForm<FormData>({
    resolver: zodResolver(userTagParamSchema),
    defaultValues: { userTag: '' },
  });

  const onSubmit = (data: FormData) => {
    Keyboard.dismiss();

    sendRequestMutation.mutate(data.userTag, {
      onSuccess: () => {
        toast.show({
          label: '친구 요청을 보냈어요',
          actionLabel: '닫기',
          onActionPress: ({ hide }) => hide(),
        });
        reset();
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
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) reset();
      }}
    >
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

          <VStack gap={16} pb={16}>
            <HStack gap={8} align="center" className="w-full">
              <Controller
                control={control}
                name="userTag"
                render={({ field: { onChange, value } }) => (
                  <Flex className="flex-1 rounded-xl border border-gray-3 bg-gray-1 px-3 py-2">
                    <BottomSheetTextInput
                      placeholder="친구태그 입력 (ABC12345)"
                      value={value}
                      onChangeText={onChange}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={8}
                      style={{ fontSize: 16 }}
                    />
                  </Flex>
                )}
              />
              <Button
                display="inline"
                size="medium"
                onPress={handleSubmit(onSubmit)}
                isLoading={sendRequestMutation.isPending}
                isDisabled={!formState.isValid}
              >
                친구 요청
              </Button>
            </HStack>
          </VStack>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
};
