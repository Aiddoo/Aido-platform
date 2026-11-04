import type { PushDevice } from "../../../domain/aggregates/delivery/push-device.aggregate.js";

export const PUSH_DEVICE_REPOSITORY = Symbol("PUSH_DEVICE_REPOSITORY");

/** 기기별 알림 권한 보고를 소유하는 영속성 포트. 토큰은 PushTokenRepositoryPort가 소유한다. */
export interface PushDeviceRepositoryPort {
  /** 계정을 바꿔 로그인한 기기라면 이전 사용자의 같은 기기 기록을 지우고 그 사용자 ID를 돌려준다. */
  releasePushDeviceHeldElsewhere(
    userId: string,
    deviceId: string,
  ): Promise<{ readonly userIds: readonly string[] }>;
  savePushDevice(device: PushDevice): Promise<void>;
  deletePushDevice(userId: string, deviceId: string): Promise<void>;
  deleteAllPushDevicesByUser(userId: string): Promise<void>;
}
