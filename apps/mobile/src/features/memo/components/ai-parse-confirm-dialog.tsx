import { ErrorCode } from '@aido/api/errors';
import { AiUsagePolicy } from '@src/features/ai/domains/ai-usage.model';
import { isAiDataSharingConsentRequiredError } from '@src/features/ai/domains/ai.error';
import { getParsedMemo } from '@src/features/ai/queries/ai-cache';
import { useGetAiUsageQueryOptions } from '@src/features/ai/queries/get-ai-usage-query-options';
import { useParseMemoMutationOptions } from '@src/features/ai/queries/use-parse-memo-mutation-options';
import { useGetMemoQueryOptions } from '@src/features/memo/queries/get-memo-query-options';
import { memoAiReviewHref } from '@src/features/memo/utils/navigation/memo-href';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { isApiError } from '@src/shared/errors';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, Text, VStack } from '@src/shared/ui';
import { useMutation, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';

interface AiParseConfirmDialogProps {
  isOpen: boolean;
  memoId: number;
  onOpenChange: (isOpen: boolean) => void;
}

export function AiParseConfirmDialog({ isOpen, memoId, onOpenChange }: AiParseConfirmDialogProps) {
  const push = useSingleTap(router.push);
  const replace = useSingleTap(router.replace);

  const { t } = useTranslation(['memo', 'common']);
  const [{ data: aiUsage }, { data: memo }, categoriesQuery] = useSuspenseQueries({
    queries: [
      useGetAiUsageQueryOptions(),
      useGetMemoQueryOptions({ memoId }),
      useGetTodoCategoriesQueryOptions(),
    ],
  });
  const queryClient = useQueryClient();
  const parseMutation = useMutation(useParseMemoMutationOptions());
  const defaultCategoryId = categoriesQuery.data.categories[0]?.id;
  const close = () => onOpenChange(false);

  if (defaultCategoryId == null) {
    return (
      <AiParseConfirmDialog.Error
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        reset={() => categoriesQuery.refetch()}
      />
    );
  }

  const remaining = AiUsagePolicy.getRemainingCount(aiUsage);

  if (remaining === 0) {
    return (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title={<ConfirmDialog.Title>{t('memo:aiDialog.limitTitle')}</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            {t('memo:aiDialog.subscribeUnlimited')}
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onPress={close}>
            {t('common:actions.close')}
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton onPress={() => replace('/settings/subscription')}>
            {t('common:premiumDialog.subscribe')}
          </ConfirmDialog.ConfirmButton>
        }
      />
    );
  }

  const warningText =
    remaining != null ? t('memo:aiDialog.warnWithDeduction') : t('memo:aiDialog.warnNoDeduction');

  const handleStart = () => {
    const cached = getParsedMemo(queryClient, { memoId });
    if (cached) {
      close();
      push(memoAiReviewHref(memoId));
      return;
    }

    parseMutation.mutate(
      { memoId, content: memo.content, categoryId: defaultCategoryId },
      {
        onSuccess: () => {
          close();
          push(memoAiReviewHref(memoId));
        },
        onError: (error) => {
          // 한도 소진 안내는 mutation 공통 프리미엄 다이얼로그가 맡고, 확인 창만 닫는다.
          // 동의가 없으면 창을 닫고, 연 쪽이 동의 안내부터 다시 시작한다.
          if (
            isAiDataSharingConsentRequiredError(error) ||
            (isApiError(error) && error.hasCode(ErrorCode.AI_1303))
          ) {
            close();
          }
        },
      },
    );
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{t('memo:aiDialog.confirmTitle')}</ConfirmDialog.Title>}
      description={
        <ConfirmDialog.Description>
          <VStack className="gap-1.5">
            {remaining != null && (
              <Text size="b3" shade={7}>
                {t('memo:aiDialog.usageRemaining', { remaining, limit: aiUsage.limit })}
              </Text>
            )}
            <Text size="e1" shade={6}>
              {warningText}
            </Text>
          </VStack>
        </ConfirmDialog.Description>
      }
      cancelButton={
        <ConfirmDialog.CancelButton testID="memo-ai-close" onPress={close}>
          {t('common:actions.close')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton
          testID="memo-ai-start"
          onPress={handleStart}
          isLoading={parseMutation.isPending}
        >
          {t('memo:aiDialog.start')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

AiParseConfirmDialog.Error = function ErrorDialog({
  isOpen,
  onOpenChange,
  reset,
}: Pick<AiParseConfirmDialogProps, 'isOpen' | 'onOpenChange'> & { reset: () => void }) {
  const { t } = useTranslation('common');

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={<ConfirmDialog.Title>{t('errorBoundary.title')}</ConfirmDialog.Title>}
      cancelButton={
        <ConfirmDialog.CancelButton onPress={() => onOpenChange(false)}>
          {t('actions.close')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={reset}>
          {t('errorBoundary.retry')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
};
