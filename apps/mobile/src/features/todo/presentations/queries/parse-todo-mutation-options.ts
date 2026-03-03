import { ErrorCode } from '@aido/errors';
import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { isApiError } from '@src/shared/errors';
import { unwrap } from '@src/shared/errors/result';
import { usePremiumDialog } from '@src/shared/ui/PremiumDialog/PremiumDialog';
import { mutationOptions } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

export const parseTodoMutationOptions = () => {
  const todoService = useTodoService();
  const premiumDialog = usePremiumDialog();

  return mutationOptions({
    mutationFn: async (text: string) => {
      const result = await todoService.parseTodo(text);
      return unwrap(result);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      if (isApiError(error) && error.hasCode(ErrorCode.AI_1303)) {
        premiumDialog.open({
          description: '프리미엄 구독으로 매일 무제한 AI 파싱을 사용할 수 있어요',
        });
      }
    },
  });
};
