import { userTagParamSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSendRequestByTagMutationOptions } from '@src/features/friend/presentations/queries/use-send-request-by-tag-mutation-options';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useTrack } from '@src/shared/analytics';
import { H3, Input, KeyboardAdaptiveButton, ShareIcon, Spacing, Text } from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Share, View } from 'react-native';
import type { z } from 'zod';

type FormData = z.infer<typeof userTagParamSchema>;

const AddFriendScreen = () => {
  const sendRequestMutation = useMutation(useSendRequestByTagMutationOptions());
  const router = useRouter();
  const { data: me } = useQuery(useGetMeQueryOptions());
  const { trackEvent } = useTrack();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(userTagParamSchema),
    defaultValues: { userTag: '' },
    mode: 'onChange',
  });

  const onSubmit = (data: FormData) => {
    sendRequestMutation.mutate(data.userTag, {
      onSuccess: () => router.back(),
    });
  };

  const handleShareInviteLink = useCallback(async () => {
    if (!me?.userTag) return;

    const url = `https://aido.kr/invite/${me.userTag}`;

    await Share.share({
      message: `Aido에서 함께 할 일을 관리해요! ${url}`,
      url,
    });

    trackEvent('invite_link_shared');
  }, [me?.userTag, trackEvent]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <H3>친구를 추가해 보세요</H3>

        <Spacing size={4} />

        <Text size="b4" shade={6}>
          친구와 할 일을 공유하고 콕 찔러줄 수 있어요
        </Text>

        <Spacing size={24} />

        <Controller
          control={control}
          name="userTag"
          render={({ field: { onChange, value } }) => (
            <Input
              label="친구 태그"
              placeholder="ABC12345"
              value={value}
              onChangeText={onChange}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              submitBehavior="submit"
              returnKeyType="done"
              isInvalid={!!errors.userTag}
              errorMessage={errors.userTag?.message}
              onSubmitEditing={() => {
                if (isValid) handleSubmit(onSubmit)();
              }}
            />
          )}
        />

        {/* 구분선 */}
        <Spacing size={32} />
        <View className="flex-row items-center gap-3">
          <View className="flex-1 h-px bg-gray-2" />
          <Text size="e1" shade={5}>
            또는
          </Text>
          <View className="flex-1 h-px bg-gray-2" />
        </View>
        <Spacing size={24} />

        {/* 초대 링크 공유 */}
        <Pressable
          className="flex-row items-center rounded-xl bg-gray-1 px-4 py-4 active:opacity-80"
          onPress={handleShareInviteLink}
        >
          <View className="mr-3 items-center justify-center rounded-full bg-primary-1 p-2">
            <ShareIcon width={20} height={20} colorClassName="text-primary-6" />
          </View>
          <View className="flex-1">
            <Text size="b3" weight="semibold">
              초대 링크 공유하기
            </Text>
            <Spacing size={2} />
            <Text size="e1" shade={6}>
              카카오톡, 문자 등으로 친구를 초대해 보세요
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      <KeyboardAdaptiveButton
        onPress={handleSubmit(onSubmit)}
        isDisabled={!isValid}
        isLoading={sendRequestMutation.isPending}
      >
        친구 추가하기
      </KeyboardAdaptiveButton>
    </View>
  );
};

export default AddFriendScreen;
