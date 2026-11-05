import { createMemoSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { MEMO_TOOLBAR_ICON } from '@src/features/memo/components/memo-detail-pane/memo-detail-actions';
import { useCreateMemoMutationOptions } from '@src/features/memo/queries/use-create-memo-mutation-options';
import { createMemoDraftKey } from '@src/features/memo/utils/memo-draft';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isConnectivityError } from '@src/shared/errors';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, STACK_BACK_ICON, StyledSafeAreaView, TextArea } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Stack, router, useFocusEffect, useNavigation } from 'expo-router';
import { Suspense, useCallback, useRef } from 'react';
import { FormProvider, useFormState, useForm } from 'react-hook-form';
import type { TextInputInstance } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useResolveClassNames } from 'uniwind';

const EMPTY_MEMO_VALUES = { content: '' };

function MemoCreateScreen() {
  const reportUnexpectedError = useReportUnexpectedError('memo');

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
              callback: (event: { data: { closing: boolean } }) => void,
            ): () => void;
          }
        | undefined
      >();
      const unsubscribe = stackNavigator?.addListener('transitionEnd', (event) => {
        if (!event.data.closing) {
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
  const { control, handleSubmit, subscribe } = formMethods;
  const { isSubmitting, isValid } = useFormState({ control });
  const discardMemoDraft = useFormDraftAutosave(subscribe, {
    initialValues: EMPTY_MEMO_VALUES,
    saveDraft: saveMemoDraft,
    clearDraft: clearMemoDraft,
  });

  const createMutation = useMutation(useCreateMemoMutationOptions());
  const { color: saveTint } = useResolveClassNames(isValid ? 'text-main' : 'text-gray-4');

  // mutate 콜백은 화면이 내려가면 불리지 않는다. 저장이 끝났는데 초안이 남지 않게 기다린 뒤에 지운다
  const saveMemo = (onFailed: (error: unknown) => void) =>
    handleSubmit(async ({ content }) => {
      try {
        await createMutation.mutateAsync({ content: content.trim() });
        discardMemoDraft();
        goBack();
      } catch (error) {
        reportUnexpectedError(error);
        onFailed(error);
      }
    });

  const handleBack = useSingleTap(async () => {
    if (!isValid) {
      goBack();
      return;
    }
    // 연결 문제로 못 보낸 글자는 초안에 남으니 화면에 가두지 않는다
    await saveMemo((error) => {
      if (isConnectivityError(error)) {
        goBack();
      }
    })();
  });

  return (
    <FormProvider {...formMethods}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon={STACK_BACK_ICON}
            accessibilityLabel={t('common:actions.goBack')}
            disabled={isSubmitting}
            onPress={handleBack}
          />
        </Stack.Toolbar>
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={MEMO_TOOLBAR_ICON.save}
            accessibilityLabel={t('common:actions.save')}
            variant="prominent"
            tintColor={saveTint}
            disabled={!isValid || isSubmitting}
            onPress={() => saveMemo(noop)()}
          />
        </Stack.Toolbar>
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

export default function MemoCreateRoute() {
  return (
    <QueryErrorBoundary>
      <Suspense fallback={null}>
        <MemoCreateScreen />
      </Suspense>
    </QueryErrorBoundary>
  );
}
