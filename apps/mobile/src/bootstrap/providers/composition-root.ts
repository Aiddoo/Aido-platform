import { setGlobalLogger } from '@src/shared/infra/logger';
import { openEncryptedStorage } from '@src/shared/infra/storage/encrypted-draft-storage';

import { createAppQueryClient } from '../query/create-app-query-client';
import { createCompositionRoot } from './create-composition-root';
import { createDevicePorts, type DevicePorts } from './create-device-ports';

/**
 * 프로세스 수명 객체의 유일한 주인이다. 로거·QueryClient·SecureStore·토큰과 갱신기·HTTP·결제 SDK를 여기서 한 번 만들어
 * 루트 "다시 시도"가 트리를 다시 그려도 같은 것을 쓴다. 앱의 모듈 수준 값은 이 파일에만 둔다(architecture.md#수명)
 */
export const compositionRoot = createCompositionRoot({
  createDevicePorts: createProcessDevicePorts,
  openEncryptedStorage,
  createQueryClient: createAppQueryClient,
});

/** DI 밖에서 쓰는 전역 `logger`도 같은 구현을 보게 한다 */
function createProcessDevicePorts(): DevicePorts {
  const ports = createDevicePorts();
  setGlobalLogger(ports.logger);
  return ports;
}
