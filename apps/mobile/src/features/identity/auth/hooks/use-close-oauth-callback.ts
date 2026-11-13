import { useSocialAuth } from '@src/bootstrap/providers/di-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Android OAuth 콜백 deep link가 연 화면을 바로 닫는다. 열어 둔 브라우저 세션이 URL을 받게 끝낸 뒤 로그인·계정 연결을
 * 시작한 화면으로 돌아가 그 화면이 코드 교환을 마친다. 다른 화면으로 보내면 로그인이 두 겹 쌓이거나 계정 연결 중에 피드로 끌려간다.
 * 돌아갈 화면이 없으면(브라우저에 있는 사이 앱이 꺼졌다) 첫 화면이 인증 상태로 정한다
 */
export function useCloseOAuthCallback() {
  const socialAuth = useSocialAuth();
  const router = useRouter();

  // 꺼진 앱이 이 화면으로 열리면 첫 렌더가 끝나기 전이라 전역 router를 쓸 수 없다. Redirect처럼 focus에서 이동한다
  useFocusEffect(
    useCallback(() => {
      socialAuth.completeOAuthSession();
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace('/');
    }, [router, socialAuth]),
  );
}
