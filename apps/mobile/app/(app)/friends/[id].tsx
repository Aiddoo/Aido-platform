import { StyledSafeAreaView, Text } from '@src/shared/ui';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

const FriendProfileScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <View className="flex-1 justify-center items-center">
        <Text size="b1" shade={9}>
          친구 프로필
        </Text>
        <Text size="b3" shade={5} className="mt-2">
          ID: {id}
        </Text>
      </View>
    </StyledSafeAreaView>
  );
};

export default FriendProfileScreen;
