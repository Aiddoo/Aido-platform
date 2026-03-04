import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { ScrollView, Text } from 'react-native';

const ReportsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="flex-1">
        <Text className="text-gray-9 text-lg font-semibold">AI 리포트</Text>
        <Text className="text-gray-5 text-sm">준비 중이에요</Text>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default ReportsScreen;
