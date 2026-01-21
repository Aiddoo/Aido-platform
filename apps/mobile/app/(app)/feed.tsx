import { Text } from '@src/shared/ui/Text/Text';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FeedScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <Text>Feed</Text>
    </SafeAreaView>
  );
}
