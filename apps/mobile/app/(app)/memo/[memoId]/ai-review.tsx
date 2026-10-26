import { AI_PARSE_LIMITS } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { zodResolver } from '@hookform/resolvers/zod';
import { getParsedMemo } from '@src/features/ai/queries/ai-cache';
import { MemoTodoEditor } from '@src/features/memo/components/memo-todo-editor';
import { memoReviewFormSchema } from '@src/features/memo/domains/memo-review-form.schema';
import {
  memoScreenParamsSchema,
  useMemoScreenParams,
} from '@src/features/memo/hooks/use-memo-screen-params';
import { useConvertMemoToTodosMutationOptions } from '@src/features/memo/queries/use-convert-memo-to-todos-mutation-options';
import { toReviewedMemoConversionInput } from '@src/features/memo/utils/to-reviewed-memo-conversion-input';
import { isApiError } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  KeyboardAdaptiveButton,
  QueryErrorBoundary,
  Result,
  StyledSafeAreaView,
  Text,
  VStack,
  type QueryErrorFallbackProps,
} from '@src/shared/ui';
import { impactFeedback } from '@src/shared/utils/haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense, useEffect, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useFormState } from 'react-hook-form';
import { ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

/** 고치는 제목을 키보드 위 생성 버튼보다 이만큼 더 위에 둔다 */
const FOCUSED_TITLE_GAP = 16;

function AiReviewScreen() {
  const { t } = useTranslation('memo');
  const goBack = useSingleTap(router.back);
  const { memoId } = useMemoScreenParams();
  const queryClient = useQueryClient();
  const dismiss = useSingleTap(router.dismiss);
  const navigate = useSingleTap(router.navigate);
  const parsedResult = getParsedMemo(queryClient, { memoId });

  const formMethods = useForm({
    resolver: zodResolver(memoReviewFormSchema),
    defaultValues: { todos: parsedResult?.todos ?? [] },
    mode: 'onChange',
  });
  const { control, handleSubmit } = formMethods;
  const { fields, remove } = useFieldArray({ control, name: 'todos' });
  const { isValid } = useFormState({ control });
  const convertMutation = useMutation(useConvertMemoToTodosMutationOptions());
  // 글꼴 크기에 따라 달라지는 실제 버튼 높이만큼 올려 큰 글꼴·작은 화면에서도 제목이 버튼에 가리지 않게 한다
  const [submitButtonHeight, setSubmitButtonHeight] = useState(0);

  useEffect(() => {
    if (!parsedResult) {
      goBack();
    }
  }, [parsedResult, goBack]);

  const handleRemoveTodo = (index: number) => {
    impactFeedback(ImpactFeedbackStyle.Light);
    remove(index);
  };

  const handleConfirm = handleSubmit(({ todos }) => {
    convertMutation.mutate(
      {
        memoId,
        input: toReviewedMemoConversionInput(todos),
      },
      {
        onSuccess: () => {
          dismiss();
          navigate('/feed');
        },
      },
    );
  });

  if (!parsedResult) {
    return null;
  }

  if (fields.length === 0) {
    return (
      <Result
        title={t('aiReview.noTodosTitle')}
        button={<Result.Button onPress={() => goBack()}>{t('aiReview.goBack')}</Result.Button>}
      />
    );
  }

  return (
    <FormProvider {...formMethods}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}
        bottomOffset={submitButtonHeight + FOCUSED_TITLE_GAP}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {parsedResult.omittedTodoCount > 0 && (
          <Text size="b3" shade={6}>
            {t('aiReview.omittedTodos', {
              count: parsedResult.omittedTodoCount,
              max: AI_PARSE_LIMITS.MEMO_MAX_TODOS,
            })}
          </Text>
        )}
        {fields.map((field, index) => (
          <MemoTodoEditor key={field.id} index={index} onRemove={() => handleRemoveTodo(index)} />
        ))}
      </KeyboardAwareScrollView>

      <KeyboardAdaptiveButton
        onLayout={(event) => setSubmitButtonHeight(event.nativeEvent.layout.height)}
        onPress={() => handleConfirm()}
        isDisabled={!isValid}
        isLoading={convertMutation.isPending}
        testID="ai-review-submit"
      >
        {t('aiReview.createCount', { count: fields.length })}
      </KeyboardAdaptiveButton>
    </FormProvider>
  );
}

AiReviewScreen.Loading = function Loading() {
  const { t } = useTranslation('memo');
  return (
    <VStack className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator size="large" />
      <Text size="b3" shade={7}>
        {t('aiReview.analyzing')}
      </Text>
    </VStack>
  );
};

AiReviewScreen.Error = function ErrorFallback({ error }: Pick<QueryErrorFallbackProps, 'error'>) {
  const { t } = useTranslation(['memo', 'common']);
  const replace = useSingleTap(router.replace);
  const goBack = useSingleTap(router.back);

  if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
    return (
      <Result
        title={t('memo:aiReview.limitTitle')}
        description={t('memo:aiDialog.subscribeUnlimited')}
        button={
          <Result.Button onPress={() => replace('/settings/subscription')}>
            {t('common:premiumDialog.subscribe')}
          </Result.Button>
        }
      />
    );
  }

  const message = isApiError(error) ? error.message : t('memo:aiReview.retryLater');

  return (
    <Result
      title={t('memo:aiReview.parseFailed')}
      description={message}
      button={<Result.Button onPress={() => goBack()}>{t('memo:aiReview.goBack')}</Result.Button>}
    />
  );
};

export default function AiReviewRoute() {
  const params = memoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/memo" />;
  }

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 bg-white">
      <QueryErrorBoundary fallback={({ error }) => <AiReviewScreen.Error error={error} />}>
        <Suspense fallback={<AiReviewScreen.Loading />}>
          <AiReviewScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}
