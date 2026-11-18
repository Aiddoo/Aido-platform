import { EntityId } from "#api/shared/domain/model/entity-id";

// 앱 설치 하나가 만든 deviceId다. 보고 때 다른 사용자의 같은 기기 기록을 지우므로 한 시점에 주인은 한 명이다
export class PushDeviceId extends EntityId<string> {
  static reconstitute(value: string): PushDeviceId {
    return new PushDeviceId(value);
  }
}
