import { useAuth } from '@src/bootstrap/providers/auth-provider';
import { useAuthService } from '@src/bootstrap/providers/di-provider';
import { mutationOptions } from '@tanstack/react-query';

export const openAppleLoginMutationOptions = () => {
  const authService = useAuthService();
  const { setStatus } = useAuth();

  return mutationOptions({
    mutationFn: () => authService.openAppleLogin(),
    onSuccess: () => {
      // Apple 로그인은 Repository에서 토큰 저장까지 완료
      // AuthProvider status만 변경하면 자동으로 메인 화면 이동
      setStatus('authenticated');
    },
  });
};
