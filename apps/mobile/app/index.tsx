import { useAuth } from '@src/core/auth';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // 로그인 안 되어 있으면 로그인 화면으로
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // 로그인 되어 있으면 홈 화면으로 (나중에 구현)
  return <Redirect href="/login" />;
}
