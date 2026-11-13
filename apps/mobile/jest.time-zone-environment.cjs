const NativeEnvironment = require('jest-expo/src/preset/nativeEnvironment');

/**
 * 파일 docblock의 `@time-zone`으로 그 파일만 프로세스 시간대를 바꾼다. 테스트 안의 `process.env`는 사본이라
 * 바꿔도 Date·Intl이 따르지 않는다. worker는 다음 파일을 이어 돌리므로 끝나면 원래 시간대로 돌린다
 */
class TimeZoneEnvironment extends NativeEnvironment {
  constructor(config, context) {
    super(config, context);
    this.timeZone = context.docblockPragmas['time-zone'];
  }

  async setup() {
    this.previousTimeZone = process.env.TZ;
    process.env.TZ = this.timeZone;
    await super.setup();
  }

  async teardown() {
    if (this.previousTimeZone == null) {
      delete process.env.TZ;
    } else {
      process.env.TZ = this.previousTimeZone;
    }
    await super.teardown();
  }
}

module.exports = TimeZoneEnvironment;
module.exports.TestEnvironment = TimeZoneEnvironment;
