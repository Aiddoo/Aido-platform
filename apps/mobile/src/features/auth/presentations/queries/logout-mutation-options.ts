import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions, useQueryClient } from '@tanstack/react-query';

export const logoutMutationOptions = () => {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: () => authService.logout(),
    // API 성공/실패 관계없이 항상 로그아웃 처리
    onSuccess: () => {
      setStatus('unauthenticated');
      queryClient.clear();
    },
  });
};
