import { useTranslation } from '@src/shared/i18n';
import { Text } from '@src/shared/ui';
import { parseWebViewUrl } from '@src/shared/utils/route-params';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';

const WebViewScreen = () => {
  const { url } = useLocalSearchParams();
  const { t } = useTranslation();

  const decodedUrl = parseWebViewUrl(url);

  if (!decodedUrl) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text size="b3">{t('webview.invalidUrl')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('webview.title'),
          headerBackTitle: t('webview.back'),
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
