/**
 * useOpenKakaoLogin Hook (Presentation Layer)
 *
 * 카카오 로그인 WebBrowser를 열고 OAuth 인증 플로우를 처리하는 Mutation Hook입니다.
 * 성공 시 인증 코드를 반환하고, 취소/실패 시 null을 반환합니다.
 */

import { useMutation } from '@tanstack/react-query';
import { useAuthService } from '../providers/auth.provider';

export const useOpenKakaoLogin = () => {
  const authService = useAuthService();

  return useMutation({
    mutationFn: () => authService.openKakaoLogin(),
  });
};
