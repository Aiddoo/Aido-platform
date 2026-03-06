import { userTagParamSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSendRequestByTagMutationOptions } from '@src/features/friend/presentations/queries/use-send-request-by-tag-mutation-options';
import { KeyboardAdaptiveButton } from '@src/shared/ui/Button';
import { Input } from '@src/shared/ui/Input';
import { Spacing } from '@src/shared/ui/Spacing';
import { H3, Text } from '@src/shared/ui/Text';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import type { z } from 'zod';

type FormData = z.infer<typeof userTagParamSchema>;

const AddFriendScreen = () => {
  const sendRequestMutation = useMutation(useSendRequestByTagMutationOptions());
  const router = useRouter();

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
