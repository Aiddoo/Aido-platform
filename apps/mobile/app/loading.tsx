import { Box } from '@src/shared/ui';
import { ActivityIndicator } from 'react-native';

export default function LoadingScreen() {
  return (
    <Box className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" />
    </Box>
  );
}
