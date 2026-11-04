import { isAiDataSharingConsentRequiredError } from '@src/features/ai/domains/ai.error';
import { getParsedMemo } from '@src/features/ai/queries/ai-cache';
import { useParseMemoMutationOptions } from '@src/features/ai/queries/use-parse-memo-mutation-options';
import { useGetMemoQueryOptions } from '@src/features/memo/queries/get-memo-query-options';
import { memoAiReviewHref } from '@src/features/memo/utils/navigation/memo-href';
import { findLimitedFeature } from '@src/features/subscription/apis/entitlement.mapper';
import { EntitlementPolicy } from '@src/features/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/subscription/queries/get-entitlements-query-options';
import { useGetTodoCategoriesQueryOptions } from '@src/features/todo/queries/get-todo-categories-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  ConfirmDialog,
  openBugReportInquiry,
  QueryErrorActions,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/format';
import { useMutation, useQueryClient, useSuspenseQueries } from '@tanstack/react-query';
import { router } from 'expo-router';

interface AiParseConfirmDialogProps {
  isOpen: boolean;
  memoId: number;
  onOpenChange: (isOpen: boolean) => void;
}

export function AiParseConfirmDialog({ isOpen, memoId, onOpenChange }: AiParseConfirmDialogProps) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation(['memo', 'common', 'subscription']);
  const { locale } = useDateFormatContext();
  const [{ data: entitlements }, { data: memo }, categoriesQuery] = useSuspenseQueries({
    queries: [
      useGetEntitlementsQueryOptions(),
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

  // 다 썼으면 이 창을 열기 전에 한도 게이트가 막는다. 프리미엄의 넉넉한 한도는 횟수를 보이지 않는다
  const remaining = EntitlementPolicy.isFairUse(entitlements, 'AI_PARSE')
    ? null
    : EntitlementPolicy.getRemainingCount(entitlements, 'AI_PARSE');

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
          // 한도 안내는 mutation의 한도 게이트가 맡고, 확인 창만 닫는다.
          // 동의가 없으면 창을 닫고, 연 쪽이 동의 안내부터 다시 시작한다.
          if (isAiDataSharingConsentRequiredError(error) || findLimitedFeature(error) != null) {
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
              <Text size="b3" shade={7} className="tabular-nums" lineBreakStrategyIOS="hangul-word">
                {t('subscription:quota.remainingThisMonth', {
                  amount: formatCount(remaining, locale),
                })}
              </Text>
            )}
            <Text size="e1" shade={6} lineBreakStrategyIOS="hangul-word">
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
      description={
        <Box className="items-start">
          <QueryErrorActions.Inquiry
            onPress={() => {
              onOpenChange(false);
              openBugReportInquiry();
            }}
          />
        </Box>
      }
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
