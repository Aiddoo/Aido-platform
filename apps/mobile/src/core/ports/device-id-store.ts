/** 푸시 기기 등록에 쓰는 기기 식별자를 재설치 뒤에도 남겨 두는 저장소. */
export interface DeviceIdStore {
  get(): Promise<string | null>;
  save(deviceId: string): Promise<void>;
  clear(): Promise<void>;
}
