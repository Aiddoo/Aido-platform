import { createMemoSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  MemoBackButton,
  MemoSaveButton,
} from '@src/features/memo/components/memo-detail-pane/memo-detail-actions';
import { useCreateMemoMutationOptions } from '@src/features/memo/queries/use-create-memo-mutation-options';
import { createMemoDraftKey } from '@src/features/memo/utils/memo-draft';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, StyledSafeAreaView, TextArea } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Stack, router, useFocusEffect, useNavigation } from 'expo-router';
import { Suspense, useCallback, useRef } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useFormState, useForm } from 'react-hook-form';
import type { TextInputInstance } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

const EMPTY_MEMO_VALUES = { content: '' };

function MemoCreateScreen() {
  const { showBoundary } = useErrorBoundary();

  const goBack = useSingleTap(router.back);

  const { t } = useTranslation(['memo', 'common']);
  const navigation = useNavigation();
  const inputRef = useRef<TextInputInstance>(null);

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
            headerLeft: () => <MemoBackButton onPress={handleBack} isDisabled={isSubmitting} />,
            headerRight: () => (
              <MemoSaveButton
                isHighlighted={isValid}
                isDisabled={!isValid || isSubmitting}
                onPress={() => handleSave()}
              />
            ),
          }}
        />
        <StyledSafeAreaView edges={['left', 'right']} className="flex-1 px-4">
          <FormField control={control} name="content">
            {({ value, onChange }) => (
              <TextArea
                ref={inputRef}
                variant="bare"
                preserveErrorSpace={false}
                placeholder={t('create.placeholder')}
                value={value}
                onChange={onChange}
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
