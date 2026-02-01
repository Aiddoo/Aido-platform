import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TodoDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-9 text-lg">할 일 상세 화면</Text>
        <Text className="text-gray-5 mt-2">ID: {id}</Text>
      </View>
    </SafeAreaView>
  );
};

export default TodoDetailScreen;
