import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { Box, PlusIcon, RefreshIcon, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';

import { MemoPolicy } from '../domains/memo.model';
import { useGetMemoResourceLimitQueryOptions } from '../queries/memo.queries';

export const MEMO_CREATE_BUTTON_SIZE = 44;

export function MemoCreateButton() {
  const fontScaledSize = useFontScaledSize();
  const createButtonSize = fontScaledSize(MEMO_CREATE_BUTTON_SIZE);
  const push = useSingleTap(router.push);

  const toast = useAppToast();
  const { t } = useTranslation('memo');
  const { data: resourceLimit } = useSuspenseQuery(useGetMemoResourceLimitQueryOptions());
  const canCreate = MemoPolicy.canCreateMemo(resourceLimit);

  const handleCreate = () => {
    // 한도는 요금제와 상관없이 같아 업셀 대신 지우면 다시 쓸 수 있다고 알린다
    if (!canCreate) {
      toast.warning(t('toasts.limitReached', { max: resourceLimit.maxPerUser }), {
        description: t('toasts.limitReachedDescription'),
      });
      return;
    }
    push('/memo/create');
  };

  return (
    <PressableFeedback
      onPress={handleCreate}
      accessibilityRole="button"
      accessibilityLabel={t('titles.create')}
      testID="memo-create-button"
      style={{ width: createButtonSize, height: createButtonSize }}
      className={cn(
        'items-center justify-center rounded-full',
        canCreate ? 'bg-main' : 'bg-gray-4',
      )}
    >
      <PlusIcon width={24} height={24} colorClassName="text-white dark:text-gray-9" />
    </PressableFeedback>
  );
}

MemoCreateButton.Loading = function Loading() {
  const fontScaledSize = useFontScaledSize();
  const createButtonSize = fontScaledSize(MEMO_CREATE_BUTTON_SIZE);

  return <Box style={{ width: createButtonSize, height: createButtonSize }} />;
};

MemoCreateButton.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  const fontScaledSize = useFontScaledSize();
  const createButtonSize = fontScaledSize(MEMO_CREATE_BUTTON_SIZE);
  const { t } = useTranslation('common');

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityLabel={t('actions.retry')}
      onPress={reset}
      style={{ width: createButtonSize, height: createButtonSize }}
      className="items-center justify-center rounded-full bg-gray-8"
    >
      <RefreshIcon width={20} height={20} colorClassName="text-white" />
    </PressableFeedback>
  );
};
