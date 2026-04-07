import { Text } from '@src/shared/ui';
import { View } from 'react-native';

export default function MemoScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text size="b2" shade={5}>
        메모
      </Text>
    </View>
  );
}
