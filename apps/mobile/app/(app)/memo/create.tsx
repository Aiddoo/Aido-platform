import { createMemoSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateMemoMutationOptions } from '@src/features/memo/queries/use-create-memo-mutation-options';
import { createMemoDraftKey } from '@src/features/memo/utils/memo-draft';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowLeftIcon,
  CheckmarkIcon,
  QueryErrorBoundary,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { cn } from '@src/shared/utils/cn';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router, useFocusEffect, useNavigation } from 'expo-router';
import type { ComponentRef } from 'react';
import { Suspense, useCallback, useRef } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useFormState, useForm } from 'react-hook-form';
import { Pressable, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { withUniwind } from 'uniwind';

const StyledTextInput = withUniwind(TextInput);
const EMPTY_MEMO_VALUES = { content: '' };

function MemoCreateScreen() {
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
        if (!e.data.closing) {
          inputRef.current?.focus();
        }
      });
      return () => unsubscribe?.();
    }, [navigation]),
  );

  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const {
    restoredDraft: restoredMemoDraft,
    saveDraft: saveMemoDraft,
    clearDraft: clearMemoDraft,
  } = useDraftStorage(createMemoDraftKey({ userId: user.id }));
  const formMethods = useForm({
    resolver: zodResolver(createMemoSchema),
    defaultValues: restoredMemoDraft ?? EMPTY_MEMO_VALUES,
    mode: 'onChange',
  });
  const {
    control,
    handleSubmit,
    subscribe,
    formState: { isValid },
  } = formMethods;
  const { isSubmitting } = useFormState({ control: control });
  const discardMemoDraft = useFormDraftAutosave(subscribe, {
    initialValues: EMPTY_MEMO_VALUES,
    saveDraft: saveMemoDraft,
    clearDraft: clearMemoDraft,
  });

  const createMutation = useMutation(useCreateMemoMutationOptions());

  const handleSave = handleSubmit(async (data) => {
    try {
      await createMutation.mutateAsync(
        { content: data.content.trim() },
        {
          onSuccess: () => {
            discardMemoDraft();
            goBack();
          },
        },
      );
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
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
        <StyledSafeAreaView edges={['left', 'right']} className="flex-1 px-4">
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
        </StyledSafeAreaView>
      </KeyboardAvoidingView>
    </FormProvider>
  );
}

/** 제출 중 예측하지 못한 오류(showBoundary)를 이 화면 안에서 받아 다시 시도하게 한다. */
export default function MemoCreateRoute() {
  return (
    <QueryErrorBoundary>
      <Suspense fallback={null}>
        <MemoCreateScreen />
      </Suspense>
    </QueryErrorBoundary>
  );
}
