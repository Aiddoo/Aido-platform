import { compareSemanticVersions } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

// SemVer 2.0.0 우선순위로 비교한다(빌드 메타데이터는 무시, 프리릴리스는 정식보다 앞선다)
export class AppVersion extends ValueObject<string> {
  // 시작할 때 검증한 설정 값이라 다시 검증하지 않는다. 비교할 수 없는 값은 isAtLeast가 false다
  static reconstitute(raw: string): AppVersion {
    return new AppVersion(raw);
  }

  isAtLeast(other: AppVersion): boolean {
    const difference = compareSemanticVersions(this.value, other.value);
    return difference != null && difference >= 0;
  }
}
