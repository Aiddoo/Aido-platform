import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const AchievementsScreen = () => {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-9 text-lg">달성 배지</Text>
      </View>
    </SafeAreaView>
  );
};

export default AchievementsScreen;
