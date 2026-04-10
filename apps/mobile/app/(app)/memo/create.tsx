import { createMemoSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-create-memo-mutation-options';
import {
  ArrowLeftIcon,
  Box,
  CheckmarkIcon,
  HStack,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { fontScaledSize } from '@src/shared/utils/scale';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);

import type { z } from 'zod';

type CreateMemoFormInput = z.infer<typeof createMemoSchema>;

export default function MemoCreateScreen() {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isValid },
  } = useForm<CreateMemoFormInput>({
    resolver: zodResolver(createMemoSchema),
    defaultValues: { content: '' },
    mode: 'onChange',
  });

  const createMutation = useMutation(useCreateMemoMutationOptions());

  const handleSave = handleSubmit((data) => {
    createMutation.mutate({ content: data.content.trim() }, { onSuccess: () => router.back() });
  });

  const handleBack = () => {
    if (isValid) {
      const content = getValues('content').trim();
      createMutation.mutate(
        { content },
        {
          onSuccess: () => router.back(),
        },
      );
      return;
    }
    router.back();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Box className="flex-1" px={8}>
          <HStack align="center" mb={16}>
            <PressableFeedback
              onPress={handleBack}
              isDisabled={createMutation.isPending}
              style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
              className="items-center justify-center"
            >
              <ArrowLeftIcon width={24} height={24} colorClassName="text-gray-10" />
            </PressableFeedback>

            <Box className="flex-1 items-center">
              <Text size="b2" weight="medium" shade={10}>
                새 메모
              </Text>
            </Box>

            <PressableFeedback
              onPress={handleSave}
              isDisabled={!isValid || createMutation.isPending}
              style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
              className={cn(
                'items-center justify-center rounded-full',
                isValid ? 'bg-main' : 'bg-gray-4',
              )}
            >
              <CheckmarkIcon width={20} height={20} color="white" />
            </PressableFeedback>
          </HStack>

          <Controller
            control={control}
            name="content"
            render={({ field: { value, onChange } }) => (
              <StyledTextInput
                placeholder="아이디어를 자유롭게 적어보세요..."
                value={value}
                onChangeText={onChange}
                autoFocus
                multiline
                textAlignVertical="top"
                allowFontScaling={false}
                className="flex-1 text-gray-8 text-input-lg placeholder:text-gray-5"
              />
            )}
          />
        </Box>
      </KeyboardAvoidingView>
    </StyledSafeAreaView>
  );
}
