import { StyledSafeAreaView } from '@src/shared/ui';
import { Text } from 'react-native';

export default function NotificationSettingsScreen() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <Text>알림 설정 (WIP)</Text>
    </StyledSafeAreaView>
  );
}
