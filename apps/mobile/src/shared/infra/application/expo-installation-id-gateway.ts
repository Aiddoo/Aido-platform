import type { InstallationIdGateway } from '@src/core/ports/installation-id-gateway';
import { SECURE_STORE_OPTIONS } from '@src/shared/infra/storage/secure-store-options';
import { noop } from 'es-toolkit';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';

// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const IOS_INSTALLATION_ID_KEY = 'aido_installation_id';

/** iOS IDFV는 같은 회사 앱이 모두 지워지면 재설치 때 바뀌므로 처음 읽은 값을 키체인에 남기고, 키체인을 못 읽으면 지금 IDFV로 대신한다 */
async function getIosInstallationId() {
  try {
    const stored = await SecureStore.getItemAsync(IOS_INSTALLATION_ID_KEY, SECURE_STORE_OPTIONS);
    if (stored != null) {
      return stored;
    }
  } catch {
    return Application.getIosIdForVendorAsync();
  }

  const vendorId = await Application.getIosIdForVendorAsync();
  if (vendorId != null) {
    // 저장에 실패해도 이번 값은 그대로 쓰고, 다음 실행 때 같은 vendor id로 다시 저장한다
    await SecureStore.setItemAsync(IOS_INSTALLATION_ID_KEY, vendorId, SECURE_STORE_OPTIONS).catch(
      noop,
    );
  }
  return vendorId;
}

export const expoInstallationIdGateway: InstallationIdGateway = {
  async get() {
    if (process.env.EXPO_OS === 'ios') {
      return getIosInstallationId();
    }
    // Android ID는 같은 서명 키·사용자·기기에서 재설치해도 같다
    if (process.env.EXPO_OS === 'android') {
      return Application.getAndroidId();
    }

    return null;
  },
};
