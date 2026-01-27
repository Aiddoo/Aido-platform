import { BellIcon } from '@src/shared/ui/Icon';
import { Stack } from 'expo-router';
import { Pressable, View } from 'react-native';

export default function FeedLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerTitle: '',
        headerRight: () => (
          <View className="justify-center items-center">
            <Pressable onPress={() => console.log('알림')} hitSlop={8} className="p-2">
              <BellIcon width={24} height={24} colorClassName="text-gray-8" />
            </Pressable>
          </View>
        ),
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
