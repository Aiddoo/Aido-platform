import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NotificationsScreen = () => {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-9 text-lg">알림 목록</Text>
      </View>
    </SafeAreaView>
  );
};

export default NotificationsScreen;
