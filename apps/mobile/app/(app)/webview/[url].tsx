import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

const WebViewScreen = () => {
  const { url } = useLocalSearchParams<{ url: string }>();

  if (!url || typeof url !== 'string') {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>유효하지 않은 URL입니다</Text>
      </View>
    );
  }

  const decodedUrl = decodeURIComponent(url);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '웹페이지',
          headerBackTitle: '뒤로',
        }}
      />
      <WebView
        source={{ uri: decodedUrl }}
        style={{ flex: 1 }}
        startInLoadingState
        scalesPageToFit
        renderLoading={() => (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" />
          </View>
        )}
      />
    </>
  );
};

export default WebViewScreen;
