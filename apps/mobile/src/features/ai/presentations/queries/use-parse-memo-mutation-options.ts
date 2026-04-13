import { ErrorCode } from '@aido/errors';
import { useAiService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { useAppToast } from '@src/shared/hooks/useAppToast';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

interface ParseMemoParams {
  content: string;
  categoryId: number;
}

export const useParseMemoMutationOptions = () => {
  const aiService = useAiService();
  const toast = useAppToast();

  return mutationOptions({
    mutationFn: async ({ content, categoryId }: ParseMemoParams) => {
      const result = await aiService.parseMemo(content, categoryId);
      return unwrap(result);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
        toast.error('오늘의 AI 사용 횟수를 모두 사용했어요');
        return;
      }

      if (isApiError(error)) {
        toast.error(error.message);
        return;
      }

      toast.error(undefined, { fallback: '잠시 후 다시 시도해 주세요' });
    },
  });
};
