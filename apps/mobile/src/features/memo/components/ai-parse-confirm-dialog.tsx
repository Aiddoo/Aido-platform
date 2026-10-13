import { ErrorCode } from '@aido/api/errors';
import { AiUsagePolicy } from '@src/features/ai/domains/ai-usage.model';
import { getParsedMemo } from '@src/features/ai/queries/ai-cache';
import { useGetAiUsageQueryOptions } from '@src/features/ai/queries/get-ai-usage-query-options';
import { useParseMemoMutationOptions } from '@src/features/ai/queries/use-parse-memo-mutation-options';
import { useGetMemoQueryOptions } from '@src/features/memo/queries/get-memo-query-options';
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
  onClose: () => void;
}

export function AiParseConfirmDialog({ isOpen, memoId, onClose }: AiParseConfirmDialogProps) {
  const push = useSingleTap(router.push);
  const replace = useSingleTap(router.replace);

  const { t } = useTranslation(['memo', 'common']);
  const [{ data: aiUsage }, { data: memo }, { data: categoriesData }] = useSuspenseQueries({
    queries: [
      useGetAiUsageQueryOptions(),
      useGetMemoQueryOptions({ id: memoId }),
      useGetTodoCategoriesQueryOptions(),
    ],
  });
  const queryClient = useQueryClient();
  const parseMutation = useMutation(useParseMemoMutationOptions());
  const defaultCategoryId = categoriesData.categories[0]?.id;

  if (defaultCategoryId == null) {
    return null;
  }

  const remaining = AiUsagePolicy.getRemainingCount(aiUsage);

  if (remaining === 0) {
    return (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
        title={<ConfirmDialog.Title>{t('memo:aiDialog.limitTitle')}</ConfirmDialog.Title>}
        description={
          <ConfirmDialog.Description>
            {t('memo:aiDialog.subscribeUnlimited')}
          </ConfirmDialog.Description>
        }
        cancelButton={
          <ConfirmDialog.CancelButton onPress={onClose}>
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
      onClose();
      push(`/memo/${memoId}/ai-review`);
      return;
    }

    parseMutation.mutate(
      { memoId, content: memo.content, categoryId: defaultCategoryId },
      {
        onSuccess: () => {
          onClose();
          push(`/memo/${memoId}/ai-review`);
        },
        onError: (error) => {
          if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
            onClose();
            replace('/settings/subscription');
          }
        },
      },
    );
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
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
        <ConfirmDialog.CancelButton onPress={onClose}>
          {t('common:actions.close')}
        </ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onPress={handleStart} isLoading={parseMutation.isPending}>
          {t('memo:aiDialog.start')}
        </ConfirmDialog.ConfirmButton>
      }
    />
  );
}

AiParseConfirmDialog.Error = function ErrorDialog({
  isOpen,
  onClose,
  reset,
}: Pick<AiParseConfirmDialogProps, 'isOpen' | 'onClose'> & { reset: () => void }) {
  const { t } = useTranslation('common');

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      title={<ConfirmDialog.Title>{t('errorBoundary.title')}</ConfirmDialog.Title>}
      cancelButton={
        <ConfirmDialog.CancelButton onPress={onClose}>
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
