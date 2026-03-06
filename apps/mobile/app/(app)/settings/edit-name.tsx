import { zodResolver } from '@hookform/resolvers/zod';
import { type UpdateNameInput, updateNameInputSchema } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { useUpdateProfileMutationOptions } from '@src/features/user/presentations/queries/use-update-profile-mutation-options';
import { H3, Input, KeyboardAdaptiveButton, QueryErrorBoundary, Spacing } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Suspense } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, View } from 'react-native';

const EditNameScreen = () => {
  return (
    <View className="flex-1 bg-gray-1">
      <QueryErrorBoundary>
        <Suspense fallback={<View className="flex-1" />}>
          <EditNameForm />
        </Suspense>
      </QueryErrorBoundary>
    </View>
  );
};

export default EditNameScreen;

function EditNameForm() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const updateProfileMutation = useMutation(useUpdateProfileMutationOptions());
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
  } = useForm<UpdateNameInput>({
    resolver: zodResolver(updateNameInputSchema),
    defaultValues: { name: user.name },
    mode: 'onChange',
  });

  const canSubmit = isValid && isDirty;

  const onSubmit = (data: UpdateNameInput) => {
    updateProfileMutation.mutate({ name: data.name }, { onSuccess: () => router.back() });
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <H3>이름을 입력해주세요</H3>

        <Spacing size={24} />

        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value } }) => (
            <Input
              label="이름"
              placeholder="이름을 입력해주세요"
              value={value}
              onChangeText={onChange}
              autoFocus
              autoCapitalize="none"
              submitBehavior="submit"
              returnKeyType="done"
              isInvalid={!!errors.name}
              errorMessage={errors.name?.message}
              onSubmitEditing={() => {
                if (canSubmit) handleSubmit(onSubmit)();
              }}
            />
          )}
        />
      </ScrollView>

      <KeyboardAdaptiveButton
        onPress={handleSubmit(onSubmit)}
        isDisabled={!canSubmit}
        isLoading={updateProfileMutation.isPending}
      >
        이름 변경
      </KeyboardAdaptiveButton>
    </View>
  );
}
