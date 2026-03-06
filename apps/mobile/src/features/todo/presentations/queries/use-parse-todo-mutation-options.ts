import { ErrorCode } from '@aido/errors';
import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { usePremiumDialog } from '@src/shared/ui';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const useParseTodoMutationOptions = () => {
  const todoService = useTodoService();
  const premiumDialog = usePremiumDialog();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async (params: { text: string; categoryId?: number }) => {
      const result = await todoService.parseTodo(params.text, params.categoryId);
      return unwrap(result);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
        premiumDialog.open({
          description: '프리미엄 구독으로 매일 무제한 AI 파싱을 사용할 수 있어요',
        });
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }

      toast.error(undefined, { fallback: '할 일을 제대로 이해하지 못했어요. 다시 시도해주세요.' });
    },
  });
};
