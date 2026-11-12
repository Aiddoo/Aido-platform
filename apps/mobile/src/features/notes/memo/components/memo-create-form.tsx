import { zodResolver } from '@hookform/resolvers/zod';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isConnectivityError } from '@src/shared/errors';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { STACK_BACK_ICON, StyledSafeAreaView, TextArea } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Stack, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { Controller, useForm, useFormState } from 'react-hook-form';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { useCreateMemoMutationOptions } from '../queries/memo.mutations';
import { EMPTY_MEMO_FORM_VALUES, memoFormSchema } from '../schemas/memo-form.schema';
import { createMemoDraftKey } from '../utils/memo-draft';
import { MEMO_TOOLBAR_ICON } from '../utils/memo-toolbar.view-model';

export function MemoCreateForm() {
  const goBack = useGoBack({ fallbackHref: '/memo' });
  const { t } = useTranslation(['memo', 'common']);
  const navigation = useNavigation();
  const accountId = useSuspenseMyAccountId();
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoDraftKey({ userId: accountId }),
  );
  const form = useForm({
    resolver: zodResolver(memoFormSchema),
    defaultValues: restoredDraft ?? EMPTY_MEMO_FORM_VALUES,
    mode: 'onChange',
  });
  const { isSubmitting, isValid } = useFormState({ control: form.control });
  const discardDraft = useFormDraftAutosave(form.subscribe, {
    initialValues: EMPTY_MEMO_FORM_VALUES,
    saveDraft,
    clearDraft,
  });
  const createMemo = useMutation(useCreateMemoMutationOptions());
  const saveTint = useResolvedColor(isValid ? 'text-main' : 'text-gray-4');

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
          form.setFocus('content');
        }
      });

      return () => unsubscribe?.();
    }, [navigation, form]),
  );

  // mutate 콜백은 화면이 내려가면 불리지 않는다. 저장이 끝났는데 초안이 남지 않게 기다린 뒤에 지운다
  const saveMemo = form.handleSubmit(async ({ content }) => {
    try {
      await createMemo.mutateAsync({ content: content.trim() });
      discardDraft();
      goBack();
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  });

  const saveAndLeave = form.handleSubmit(async ({ content }) => {
    try {
      await createMemo.mutateAsync({ content: content.trim() });
      discardDraft();
      goBack();
    } catch (error) {
      // 연결 문제로 못 보낸 글자는 초안에 남으니 화면에 가두지 않는다
      if (isConnectivityError(error)) {
        goBack();
      }
    }
  });

  const handleSave = useSingleTap(() => saveMemo());

  const handleBack = useSingleTap(async () => {
    if (!isValid) {
      goBack();

      return;
    }
    await saveAndLeave();
  });

  return (
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
          onPress={handleSave}
        />
      </Stack.Toolbar>

      <StyledSafeAreaView edges={['left', 'right']} className="flex-1 px-4">
        <Controller
          control={form.control}
          name="content"
          render={({ field: { value, onChange, ref } }) => (
            <TextArea
              ref={ref}
              variant="bare"
              preserveErrorSpace={false}
              placeholder={t('create.placeholder')}
              value={value}
              onChange={onChange}
              testID="memo-create-input"
            />
          )}
        />
      </StyledSafeAreaView>
    </KeyboardAvoidingView>
  );
}
