import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** RevenueCat 공개 SDK 키 접두사. 다른 플랫폼 키가 들어가면 스토어가 상품을 주지 않는다 */
const KEY_RULES = [
  { name: 'revenueCatAppleApiKey', env: 'REVENUECAT_APPLE_API_KEY', prefix: 'appl_' },
  { name: 'revenueCatGoogleApiKey', env: 'REVENUECAT_GOOGLE_API_KEY', prefix: 'goog_' },
  { name: 'revenueCatTestApiKey', env: 'REVENUECAT_TEST_API_KEY', prefix: 'test_' },
];

export const APP_ENVIRONMENTS = ['development', 'preview', 'production'];

/** 값은 접두사와 길이만 보여 준다. 키 전체를 터미널·CI 로그에 남기지 않는다 */
export function maskKey(value) {
  return `${value.slice(0, 5)}… (${value.length}자)`;
}

/** 해결된 app config extra를 보고 문제를 돌려준다. 테스트 키는 개발 번들에만 있어야 한다 */
export function inspectRevenueCatExtra(extra, appEnv) {
  const problems = [];
  const rows = KEY_RULES.map(({ name, env, prefix }) => {
    const value = extra?.[name];
    const isTestKey = name === 'revenueCatTestApiKey';
    if (isTestKey && appEnv !== 'development') {
      if (value != null) {
        problems.push(`${appEnv} 번들에 ${env}가 들어 있어요. 개발 번들에만 넣어야 해요.`);
      }
      return { env, status: value == null ? '없음(정상)' : maskKey(value) };
    }
    if (value == null || value === '') {
      problems.push(`${appEnv}: ${env}가 비어 있어요.`);
      return { env, status: '비어 있음' };
    }
    if (!value.startsWith(prefix)) {
      problems.push(`${appEnv}: ${env}는 ${prefix}로 시작해야 해요.`);
    }
    return { env, status: maskKey(value) };
  });
  return { rows, problems };
}

function readPublicExtra(root, appEnv) {
  const json = execFileSync('pnpm', ['exec', 'expo', 'config', '--type', 'public', '--json'], {
    cwd: root,
    env: { ...process.env, APP_ENV: appEnv },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(json).extra;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const problems = [];
  for (const appEnv of APP_ENVIRONMENTS) {
    const result = inspectRevenueCatExtra(readPublicExtra(root, appEnv), appEnv);
    console.log(`\n[${appEnv}]`);
    result.rows.forEach(({ env, status }) => console.log(`  ${env}: ${status}`));
    problems.push(...result.problems);
  }
  if (problems.length > 0) {
    console.error(`\nRevenueCat 키 점검 실패:\n- ${problems.join('\n- ')}`);
    console.error(
      '키는 EAS 환경변수(`eas env:list --environment <환경>`)와 같게 .env.development·.env에 둬요(커밋 금지).',
    );
    process.exitCode = 1;
    return;
  }
  console.log('\nRevenueCat 키 점검에 통과했어요.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
