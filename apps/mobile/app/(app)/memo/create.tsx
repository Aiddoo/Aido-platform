import { createMemoSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-create-memo-mutation-options';
import { ArrowLeftIcon, Box, CheckmarkIcon } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { Stack, useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);

import type { z } from 'zod';

type CreateMemoFormInput = z.infer<typeof createMemoSchema>;

export default function MemoCreateScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const inputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const stackNavigator = navigation.getParent<
        | {
            addListener(
              event: 'transitionEnd',
              callback: (e: { data: { closing: boolean } }) => void,
            ): () => void;
          }
        | undefined
      >();
      const unsubscribe = stackNavigator?.addListener('transitionEnd', (e) => {
        if (!e.data.closing) inputRef.current?.focus();
      });
      return () => unsubscribe?.();
    }, [navigation]),
  );

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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerLeft: () => (
            <View className="justify-center items-center">
              <Pressable
                onPress={handleBack}
                disabled={createMutation.isPending}
                hitSlop={8}
                className="p-2"
              >
                <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
              </Pressable>
            </View>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={!isValid || createMutation.isPending}
              hitSlop={8}
              className={cn(
                'items-center justify-center rounded-full p-2',
                isValid ? 'bg-main' : 'bg-gray-4',
              )}
            >
              <CheckmarkIcon width={20} height={20} color="white" />
            </Pressable>
          ),
        }}
      />
      <Box className="flex-1" px={16}>
        <Controller
          control={control}
          name="content"
          render={({ field: { value, onChange } }) => (
            <StyledTextInput
              ref={inputRef}
              placeholder="아이디어를 자유롭게 적어보세요..."
              value={value}
              onChangeText={onChange}
              multiline
              textAlignVertical="top"
              allowFontScaling={false}
              className="flex-1 text-gray-8 text-input-lg placeholder:text-gray-5"
            />
          )}
        />
      </Box>
    </KeyboardAvoidingView>
  );
}
