import { setGlobalLogger } from '@src/shared/infra/logger';
import { openEncryptedStorage } from '@src/shared/infra/storage/encrypted-draft-storage';

import { createAppQueryClient } from '../query/create-app-query-client';
import { createCompositionRoot } from './create-composition-root';
import { createDevicePorts, type DevicePorts } from './create-device-ports';

/**
 * 프로세스 수명 객체의 유일한 주인이다. 로거·QueryClient·SecureStore·토큰과 갱신기·HTTP·결제 SDK를 여기서 한 번 만들어
 * 루트 "다시 시도"가 트리를 다시 그려도 같은 것을 쓴다. 프로세스 수명 객체를 담는 모듈 수준 값은 이 파일에만 둔다(docs/architecture/structure.md "DI·포트·수명")
 */
export const compositionRoot = createCompositionRoot({
  createDevicePorts: createProcessDevicePorts,
  openEncryptedStorage,
  createQueryClient: createAppQueryClient,
});

/** 프로세스에 한 번 거는 설정도 여기서 한다. 앞 알림 표시 판단은 푸시 게이트웨이를 만들 때 함께 걸린다 */
function createProcessDevicePorts(): DevicePorts {
  const ports = createDevicePorts();
  setGlobalLogger(ports.logger);
  return ports;
}
