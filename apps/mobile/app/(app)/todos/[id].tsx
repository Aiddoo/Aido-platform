import { StyledSafeAreaView, Text } from '@src/shared/ui';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

const TodoDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <View className="flex-1 justify-center items-center">
        <Text size="b1" shade={9}>
          할 일 상세 화면
        </Text>
        <Text size="b3" shade={5} className="mt-2">
          ID: {id}
        </Text>
      </View>
    </StyledSafeAreaView>
  );
};

export default TodoDetailScreen;
