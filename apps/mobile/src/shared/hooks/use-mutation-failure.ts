import { useHaptics } from '@src/bootstrap/providers/di-context';
import { getUserFacingMessage } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';

/**
 * 저장 실패를 알리는 한 곳. 햅틱과 토스트 한 번으로 알리고 화면과 입력값은 그대로 둔다.
 * 사용자 문구가 있는 오류만 그대로 보이고, 나머지는 폴백 문구로 바꾼다.
 */
export function useMutationFailure(defaultFallback?: string) {
  const haptics = useHaptics();
  const toast = useAppToast();

  return (error: unknown, fallback = defaultFallback) => {
    haptics.notify('error');
    toast.error(getUserFacingMessage(error), { fallback });
  };
}
