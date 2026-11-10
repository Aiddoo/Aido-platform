import {
  USER_LOCALE_PREFERENCE_READER,
  UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import {
  ACTION_PLAN_GENERATOR,
  ActionPlanGeneratorPort,
} from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

// voice가 클래스 토큰으로 옮기기 전까지 옛 Symbol 토큰으로 받아도 같은 인스턴스여야 한다
describe("ai-assistance 옛 Symbol 토큰 별칭 (e2e)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  it.each([
    {
      name: "사용자 언어·시간대 reader",
      legacy: USER_LOCALE_PREFERENCE_READER,
      current: UserLocalePreferenceReaderPort,
    },
    { name: "행동 계획 생성기", legacy: ACTION_PLAN_GENERATOR, current: ActionPlanGeneratorPort },
  ])("$name의 옛 토큰과 클래스 토큰은 같은 인스턴스다", ({ legacy, current }) => {
    // When
    const fromLegacy: unknown = ctx.module.get(legacy, { strict: false });
    const fromCurrent: unknown = ctx.module.get(current, { strict: false });

    // Then
    expect(fromLegacy).toBe(fromCurrent);
  });
});
