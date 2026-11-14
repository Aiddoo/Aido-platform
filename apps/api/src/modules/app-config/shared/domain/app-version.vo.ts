import { APP_STORE_VERSION_MAX_LENGTH, APP_STORE_VERSION_PATTERN } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { appStoreVersionInvalid } from "./app-config.errors.js";

const APP_STORE_VERSION_REG_EXP = new RegExp(APP_STORE_VERSION_PATTERN);

export class AppVersion extends ValueObject<string> {
  // 스토어에 공개하는 버전만 만든다. 출시 앱이 MAJOR.MINOR.PATCH가 아니면 버전 응답을 읽지 못한다
  static create(raw: string): AppVersion {
    const isStoreVersion =
      raw.length <= APP_STORE_VERSION_MAX_LENGTH && APP_STORE_VERSION_REG_EXP.test(raw);
    if (!isStoreVersion) {
      throw appStoreVersionInvalid(raw.length);
    }
    return new AppVersion(raw);
  }

  // 저장된 값과 시작할 때 검증한 설정 값이라 다시 검증하지 않는다
  static reconstitute(raw: string): AppVersion {
    return new AppVersion(raw);
  }
}
