import { ErrorCode } from '@aido/api/errors';
import type { ParsedMemoTodo } from '@src/features/ai/domains/ai.model';
import { getParsedMemo } from '@src/features/ai/queries/ai-cache';
import { MemoTodoEditor } from '@src/features/memo/components/memo-todo-editor';
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
  Button,
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
import { Suspense, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';

type TodoWithId = ParsedMemoTodo & { _key: string };

function AiReviewScreen() {
  const { t } = useTranslation('memo');
  const goBack = useSingleTap(router.back);
  const { memoId } = useMemoScreenParams();
  const queryClient = useQueryClient();
  const dismiss = useSingleTap(router.dismiss);
  const navigate = useSingleTap(router.navigate);
  const parsedResult = getParsedMemo(queryClient, { memoId });

  const nextId = useRef(0);
  const [todos, setTodos] = useState<TodoWithId[]>(
    () => parsedResult?.todos.map((todo) => ({ ...todo, _key: `todo-${nextId.current++}` })) ?? [],
  );
  const convertMutation = useMutation(useConvertMemoToTodosMutationOptions());

  useEffect(() => {
    if (!parsedResult) {
      goBack();
    }
  }, [parsedResult, goBack]);

  const updateTodo = (index: number, updates: Partial<ParsedMemoTodo>) => {
    setTodos((prev) => prev.map((todo, i) => (i === index ? { ...todo, ...updates } : todo)));
  };

  const handleRemoveTodo = (index: number) => {
    impactFeedback(ImpactFeedbackStyle.Light);
    setTodos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (todos.length === 0) {
      return;
    }

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
  };

  if (!parsedResult) {
    return null;
  }

  if (todos.length === 0) {
    return (
      <Result
        title={t('aiReview.noTodosTitle')}
        button={<Result.Button onPress={() => goBack()}>{t('aiReview.goBack')}</Result.Button>}
      />
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 16 }}
      >
        {todos.map((todo, index) => (
          <MemoTodoEditor
            key={todo._key}
            todo={todo}
            onChange={(updates) => updateTodo(index, updates)}
            onRemove={() => handleRemoveTodo(index)}
          />
        ))}
      </ScrollView>

      <StyledSafeAreaView edges={{ bottom: 'maximum' }} className="px-4 pb-4">
        <Button
          onPress={handleConfirm}
          isDisabled={todos.length === 0}
          isLoading={convertMutation.isPending}
        >
          {t('aiReview.createCount', { count: todos.length })}
        </Button>
      </StyledSafeAreaView>
    </>
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
