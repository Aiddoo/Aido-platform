import { zodResolver } from '@hookform/resolvers/zod';
import { useSuspenseMyAccountId } from '@src/features/identity/user/hooks/use-suspense-my-account-id';
import { useCreateMemoMutationOptions } from '@src/features/notes/memo/queries/memo.mutations';
import {
  EMPTY_MEMO_FORM_VALUES,
  memoFormSchema,
} from '@src/features/notes/memo/schemas/memo-form.schema';
import { createMemoDraftKey } from '@src/features/notes/memo/utils/memo-draft';
import { MEMO_TOOLBAR_ICON } from '@src/features/notes/memo/utils/memo-toolbar.view-model';
import { useDraftStorage } from '@src/shared/draft/use-draft-storage';
import { useFormDraftAutosave } from '@src/shared/draft/use-form-draft-autosave';
import { isConnectivityError } from '@src/shared/errors';
import { useGoBack } from '@src/shared/hooks/use-go-back';
import { useOnOpenTransitionEnd } from '@src/shared/hooks/use-on-open-transition-end';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  QueryErrorBoundary,
  QueryErrorFallback,
  STACK_BACK_ICON,
  StyledSafeAreaView,
  TextArea,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { Stack, useNavigation } from 'expo-router';
import { Suspense } from 'react';
import { Controller, FormState, useForm } from 'react-hook-form';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

export default function MemoCreateRoute() {
  return (
    <QueryErrorBoundary fallback={MemoCreateScreen.Error}>
      {/* 내 정보는 로그인 때 받아 둔 캐시라 기다릴 일이 거의 없다 */}
      <Suspense fallback={null}>
        <MemoCreateScreen />
      </Suspense>
    </QueryErrorBoundary>
  );
}

function MemoCreateScreen() {
  const { t } = useTranslation('memo');
  const navigation = useNavigation();
  const goBack = useGoBack({ fallbackHref: '/memo' });
  const accountId = useSuspenseMyAccountId();

  const createMemo = useMutation(useCreateMemoMutationOptions());
  const { restoredDraft, saveDraft, clearDraft } = useDraftStorage(
    createMemoDraftKey({ userId: accountId }),
  );
  // 칸과 버튼이 그 조각만 구독해 글자를 쳐도 여기는 다시 그려지지 않는다
  const form = useForm({
    resolver: zodResolver(memoFormSchema),
    defaultValues: restoredDraft ?? EMPTY_MEMO_FORM_VALUES,
    mode: 'onChange',
  });
  const discardDraft = useFormDraftAutosave(form.subscribe, {
    initialValues: EMPTY_MEMO_FORM_VALUES,
    saveDraft,
    clearDraft,
  });

  useOnOpenTransitionEnd(() => form.setFocus('content'), { isStackRoot: true });

  // 저장하는 동안 밀어서 떠났다면 지금 화면이 이전 화면이므로 또 뒤로 가지 않는다
  const leaveIfFocused = () => {
    if (navigation.isFocused()) {
      goBack();
    }
  };

  // mutate 콜백은 화면이 내려가면 불리지 않는다. 저장이 끝났는데 초안이 남지 않게 기다린 뒤에 지운다.
  // 실패는 여기서 받지 않는다. RHF가 실패로 알아야 isSubmitSuccessful이 꺼진 채 남아 다시 보낼 수 있다
  const saveMemo = form.handleSubmit(async ({ content }) => {
    await createMemo.mutateAsync({ content });
    discardDraft();
    leaveIfFocused();
  });

  // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
  const handleSavePress = useSingleTap(() => {
    saveMemo().catch(noop);
  });

  const handleBackPress = useSingleTap(({ isValid }: { isValid: boolean }) => {
    if (!isValid) {
      goBack();

      return;
    }
    saveMemo().catch((error: unknown) => {
      // 연결 문제로 못 보낸 글자는 초안에 남으니 화면에 가두지 않는다
      if (isConnectivityError(error)) {
        leaveIfFocused();
      }
    });
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset>
      <FormState
        control={form.control}
        render={({ isValid, isSubmitting, isSubmitSuccessful }) => (
          <MemoCreateToolbar
            isValid={isValid}
            // 저장하면 화면이 내려가는 동안에도 같은 글이 남고 요청 키는 지워진다. 그동안 다시 보내지 않는다
            isSubmitLocked={isSubmitting || isSubmitSuccessful}
            onBack={() => handleBackPress({ isValid })}
            onSave={handleSavePress}
          />
        )}
      />

      <StyledSafeAreaView edges={['left', 'right']} className="flex-1 px-4">
        <Controller
          control={form.control}
          name="content"
          render={({ field: { value, onChange, ref } }) => (
            <TextArea
              ref={ref}
              variant="bare"
              shouldPreserveErrorSpace={false}
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

MemoCreateScreen.Error = QueryErrorFallback;

interface MemoCreateToolbarProps {
  isValid: boolean;
  isSubmitLocked: boolean;
  onBack: () => void;
  onSave: () => void;
}

function MemoCreateToolbar({ isValid, isSubmitLocked, onBack, onSave }: MemoCreateToolbarProps) {
  const { t } = useTranslation('common');
  const saveTint = useResolvedColor(isValid ? 'text-main' : 'text-gray-4');

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon={STACK_BACK_ICON}
          accessibilityLabel={t('actions.goBack')}
          disabled={isSubmitLocked}
          onPress={onBack}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={MEMO_TOOLBAR_ICON.save}
          accessibilityLabel={t('actions.save')}
          variant="prominent"
          tintColor={saveTint}
          disabled={!isValid || isSubmitLocked}
          onPress={onSave}
        />
      </Stack.Toolbar>
    </>
  );
}
