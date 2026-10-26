import type { InstallationIdGateway } from '@src/core/ports/installation-id';
import { noop } from 'es-toolkit';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const IOS_INSTALLATION_ID_KEY = 'aido_installation_id';

// 다른 키체인 항목과 같은 조건이다. 키체인 항목은 앱을 지웠다 다시 설치해도 남는다.
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * iOS IDFV는 같은 회사 앱이 모두 지워지면 재설치 때 바뀐다. 처음 읽은 IDFV를 키체인에 남겨 재설치 뒤에도
 * 같은 값을 보낸다. 이미 IDFV로 수락한 설치도 처음 읽는 값이 지금 IDFV라 서버 해시가 그대로 이어진다.
 * 키체인을 못 읽으면(잠김 등) 지금 IDFV로 대신한다.
 */
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
    await SecureStore.setItemAsync(IOS_INSTALLATION_ID_KEY, vendorId, SECURE_STORE_OPTIONS).catch(
      noop,
    );
  }
  return vendorId;
}

export const expoInstallationIdGateway: InstallationIdGateway = {
  async get() {
    if (Platform.OS === 'ios') {
      return getIosInstallationId();
    }
    // Android ID는 같은 서명 키·사용자·기기에서 재설치해도 같다
    if (Platform.OS === 'android') {
      return Application.getAndroidId();
    }

    return null;
  },
};
