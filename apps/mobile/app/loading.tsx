import { Box } from '@src/shared/ui';

/**
 * 인증·캐시 복구 중에는 AuthGateLayout이 스플래시를 올려 두므로 이 화면은 보이지 않는다.
 * 스플래시가 이미 내려간 잠긴 키체인 대기에서만 보이며, 받은 뒤 모양을 알 수 없어 배경색만 둔다.
 */
export default function LoadingScreen() {
  return <Box className="flex-1 bg-white" />;
}
