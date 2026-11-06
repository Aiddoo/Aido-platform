import { Box } from '@src/shared/ui';
import { Spinner } from 'heroui-native';

export default function LoadingScreen() {
  return (
    <Box className="flex-1 items-center justify-center bg-white">
      <Spinner size="lg" />
    </Box>
  );
}
