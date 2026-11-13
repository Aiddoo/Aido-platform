import { ValueObject } from "#api/shared/domain/model/value-object";

// 시작할 때 SemVer로 검증한 설정 값이라 다시 검증하지 않는다
export class AppVersion extends ValueObject<string> {
  static reconstitute(raw: string): AppVersion {
    return new AppVersion(raw);
  }
}
