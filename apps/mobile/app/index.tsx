import type { Href } from 'expo-router';
import { Redirect } from 'expo-router';

export default function Index() {
  // RootLayoutNav에서 인증 상태에 따라 리다이렉트 처리
  // 이 컴포넌트는 초기 진입점으로만 사용
  return <Redirect href={'/(auth)/login' as Href} />;
}
