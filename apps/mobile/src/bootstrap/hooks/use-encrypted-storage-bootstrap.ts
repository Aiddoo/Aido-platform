import {
  type EncryptedStorageBootstrap,
  openEncryptedMmkvStorage,
} from '@src/shared/infra/storage/mmkv-draft-storage';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';
import { useEffect, useState } from 'react';

/** 암호화 키 조회가 끝날 때까지 `undefined`. 호출부는 그동안 스플래시를 유지한다. */
export const useEncryptedStorageBootstrap = (): EncryptedStorageBootstrap | undefined => {
  const [encryptedStorageBootstrap, setEncryptedStorageBootstrap] =
    useState<EncryptedStorageBootstrap>();

  useEffect(() => {
    let cancelled = false;

    openEncryptedMmkvStorage(new SecureStorage()).then((result) => {
      if (!cancelled) {
        setEncryptedStorageBootstrap(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return encryptedStorageBootstrap;
};
