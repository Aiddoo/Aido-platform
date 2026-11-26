import { Box } from '@src/shared/ui';

/** 스플래시가 이미 내려간 잠긴 키체인 대기에서만 보이며, 받은 뒤 모양을 알 수 없어 배경색만 둔다 */
export default function LoadingScreen() {
  return <Box className="flex-1 bg-white" />;
}
