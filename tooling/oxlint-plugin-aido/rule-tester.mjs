import { describe, it } from 'node:test';

import { RuleTester } from 'oxlint/plugins-dev';

RuleTester.describe = describe;
RuleTester.it = it;

/** TSX로 파싱하는 RuleTester. 경로를 보는 규칙은 케이스마다 filename을 준다 */
export function createRuleTester() {
  return new RuleTester({
    languageOptions: { sourceType: 'module', parserOptions: { lang: 'tsx' } },
  });
}
