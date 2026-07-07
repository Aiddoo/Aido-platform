import { ErrorCode } from '@aido/errors';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { useParseMemoMutationOptions } from '@src/features/ai/presentations/queries/use-parse-memo-mutation-options';
import { useGetMemoQueryOptions } from '@src/features/memo/presentations/queries/use-get-memo-query-options';
import { AiUsagePolicy } from '@src/features/todo/models/todo.model';
import { useGetAiUsageQueryOptions } from '@src/features/todo/presentations/queries/use-get-ai-usage-query-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/presentations/queries/use-get-todo-categories-query-options';
import { isApiError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import { ConfirmDialog, Text, VStack } from '@src/shared/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

interface AiParseConfirmDialogProps {
  isOpen: boolean;
  memoId: number;
  onClose: () => void;
}

export function AiParseConfirmDialog({ isOpen, memoId, onClose }: AiParseConfirmDialogProps) {
  const { t } = useTranslation(['memo', 'common']);
  const { data: aiUsage } = useQuery(useGetAiUsageQueryOptions());
  const { data: memo } = useQuery(useGetMemoQueryOptions(memoId));
  const { data: categoriesData } = useQuery(useGetTodoCategoriesQueryOptions());
  const queryClient = useQueryClient();
  const router = useRouter();
  const parseMutation = useMutation(useParseMemoMutationOptions());

  if (!aiUsage || !memo || !categoriesData) return null;

  const defaultCategoryId = categoriesData.categories[0]?.id;
  if (!defaultCategoryId) return null;

  const remaining = AiUsagePolicy.getRemainingCount(aiUsage);

  if (remaining === 0) {
    return (
      <ConfirmDialog
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
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
          <ConfirmDialog.ConfirmButton onPress={() => router.replace('/settings/subscription')}>
            {t('common:premiumDialog.subscribe')}
          </ConfirmDialog.ConfirmButton>
        }
      />
    );
  }

  const warningText =
    remaining != null ? t('memo:aiDialog.warnWithDeduction') : t('memo:aiDialog.warnNoDeduction');

  const handleStart = () => {
    const cached = queryClient.getQueryData(AI_QUERY_KEYS.parseMemo(memoId));
    if (cached) {
      onClose();
      router.push(`/memo/${memoId}/ai-review`);
      return;
    }

    parseMutation.mutate(
      { memoId, content: memo.content, categoryId: defaultCategoryId },
      {
        onSuccess: () => {
          onClose();
          router.push(`/memo/${memoId}/ai-review`);
        },
        onError: (error) => {
          if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
            onClose();
            router.replace('/settings/subscription');
          }
        },
      },
    );
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
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
