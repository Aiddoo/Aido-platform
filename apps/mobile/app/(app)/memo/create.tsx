import { createMemoSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateMemoMutationOptions } from '@src/features/memo/presentations/queries/use-create-memo-mutation-options';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { ArrowLeftIcon, Box, CheckmarkIcon } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { Stack, router, useFocusEffect, useNavigation } from 'expo-router';
import type { ComponentRef } from 'react';
import { useCallback, useRef } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider } from 'react-hook-form';
import { useFormState } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);

export default function MemoCreateScreen() {
  const { showBoundary } = useErrorBoundary();

  const goBack = useSingleTap(router.back);

  const { t } = useTranslation(['memo', 'common']);
  const navigation = useNavigation();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

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

  const formMethods = useForm({
    resolver: zodResolver(createMemoSchema),
    defaultValues: { content: '' },
    mode: 'onChange',
  });
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = formMethods;
  const { isSubmitting } = useFormState({ control: control });

  const createMutation = useMutation(useCreateMemoMutationOptions());

  const handleSave = handleSubmit(async (data) => {
    try {
      await createMutation.mutateAsync(
        { content: data.content.trim() },
        { onSuccess: () => goBack() },
      );
    } catch (error) {
      if (!isBusinessError(error)) showBoundary(error);
    }
  });

  const handleBack = useSingleTap(async () => {
    if (isValid) {
      await handleSave();
      return;
    }
    goBack();
  });

  return (
    <FormProvider {...formMethods}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Stack.Screen
          options={{
            headerLeft: () => (
              <View className="justify-center items-center">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common:actions.goBack')}
                  onPress={handleBack}
                  disabled={isSubmitting}
                  hitSlop={8}
                  className="p-2"
                >
                  <ArrowLeftIcon width={20} height={20} colorClassName="text-gray-9" />
                </Pressable>
              </View>
            ),
            headerRight: () => (
              <Pressable
                onPress={() => handleSave()}
                accessibilityRole="button"
                accessibilityLabel={t('common:actions.save')}
                disabled={!isValid || isSubmitting}
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
          <FormField control={control} name="content">
            {({ value, onChange }) => (
              <StyledTextInput
                ref={inputRef}
                placeholder={t('create.placeholder')}
                value={value}
                onChangeText={onChange}
                multiline
                textAlignVertical="top"
                allowFontScaling={false}
                className="flex-1 text-gray-8 text-input-lg placeholder:text-gray-5"
              />
            )}
          </FormField>
        </Box>
      </KeyboardAvoidingView>
    </FormProvider>
  );
}
