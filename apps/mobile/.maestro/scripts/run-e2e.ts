/**
 * Maestro E2E 실행 입구. `pnpm e2e`, `pnpm e2e:smoke`, `pnpm e2e:feature <태그>`가 부른다.
 *
 * 1. `.maestro/.env.maestro`를 읽어 MAESTRO_* 값을 Maestro에 넘긴다. Maestro가 shell 변수로 읽어 비밀번호가 명령줄에 남지 않는다.
 * 2. second 계정이 있으면 초대 흐름을 다시 돌릴 수 있게 `accounts.ts reset`을 먼저 부른다.
 * 3. push 태그 흐름이 iOS 시뮬레이터에 푸시를 넣도록 127.0.0.1에 입구를 연다(아래 startSimulatorPushServer).
 * 4. 결과·HTML 보고서는 git이 무시하는 `maestro-output/<시각>/`에 모은다.
 *
 * 나머지 인자는 `maestro test`에 그대로 넘긴다. 예: `pnpm e2e --device <udid>`, `pnpm e2e:feature category`
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join, resolve } from 'node:path';

import { z } from 'zod';

const WORKSPACE_DIR = resolve(import.meta.dirname, '..');
const OUTPUT_ROOT = resolve(WORKSPACE_DIR, '..', 'maestro-output');
const ENV_FILE = join(WORKSPACE_DIR, '.env.maestro');
const PUSH_TEMPLATE_DIR = join(WORKSPACE_DIR, 'push');
const SIMULATOR_PUSH_HOST = '127.0.0.1';
const SIMULATOR_PUSH_PORT = 8091;
const PRODUCTION_APP_ID = 'com.aido.mobile';
const DEFAULT_ENV = {
  MAESTRO_APP_ID: 'com.aido.mobile.dev',
  MAESTRO_APP_SCHEME: 'aido-dev',
  MAESTRO_API_URL: 'http://localhost:8080',
  MAESTRO_METRO_URL: 'http://localhost:8081',
} as const;

// 흐름(scripts/api.js pushToSimulator)이 보내는 값. 템플릿 이름은 push/<이름>.json이다
const simulatorPushRequestSchema = z.object({
  template: z.enum(['friend-request']),
  alert: z.object({ title: z.string(), body: z.string() }),
  data: z.record(z.string(), z.unknown()),
});
const pushTemplateSchema = z.object({
  aps: z.record(z.string(), z.unknown()),
  body: z.record(z.string(), z.unknown()),
});

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}
for (const [key, value] of Object.entries(DEFAULT_ENV)) {
  process.env[key] ??= value;
}

if (process.env.MAESTRO_SECOND_EMAIL) {
  const reset = spawnSync('node', [join(WORKSPACE_DIR, 'scripts', 'accounts.ts'), 'reset'], {
    stdio: 'inherit',
  });
  if (reset.status !== 0) {
    process.stderr.write(
      '[e2e] 계정 초기화에 실패했습니다. 초대 흐름은 수락 기록이 남아 있으면 실패합니다.\n',
    );
  }
}

// 푸시 data는 서버(push-notification-payload.mapper.ts)가 Expo로 보내는 모양이고 APNs에서는 `body` 키에 실린다.
// simctl push는 경로 대신 `-`를 주면 표준 입력에서 payload를 읽는다
function pushToSimulator(appId: string, deviceId: string, rawRequest: string): number {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawRequest);
  } catch {
    return 400;
  }
  const request = simulatorPushRequestSchema.safeParse(parsedJson);
  if (!request.success) {
    return 400;
  }
  const { template, alert, data } = request.data;
  const base = pushTemplateSchema.parse(
    JSON.parse(readFileSync(join(PUSH_TEMPLATE_DIR, `${template}.json`), 'utf8')),
  );
  const payload = { aps: { ...base.aps, alert }, body: { ...base.body, ...data } };
  const pushed = spawnSync('xcrun', ['simctl', 'push', deviceId, appId, '-'], {
    input: JSON.stringify(payload),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  return pushed.status === 0 ? 204 : 500;
}

// Maestro 흐름은 셸을 부를 수 없어 http로 이 입구에 알림 id·문구를 보낸다. 운영 앱에는 넣지 않는다
function startSimulatorPushServer(appId: string, deviceId: string): Promise<Server | null> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const status =
        appId === PRODUCTION_APP_ID
          ? 403
          : pushToSimulator(appId, deviceId, Buffer.concat(chunks).toString('utf8'));
      response.writeHead(status).end();
    });
  });
  return new Promise((settle) => {
    server.once('error', (error) => {
      process.stderr.write(
        `[e2e] 시뮬레이터 푸시 입구를 열지 못해 push 흐름은 실패합니다: ${error.message}\n`,
      );
      settle(null);
    });
    server.listen(SIMULATOR_PUSH_PORT, SIMULATOR_PUSH_HOST, () => settle(server));
  });
}

const deviceArgumentIndex = process.argv.indexOf('--device');
const pushDeviceId =
  deviceArgumentIndex === -1 ? 'booted' : (process.argv[deviceArgumentIndex + 1] ?? 'booted');
const pushServer = await startSimulatorPushServer(process.env.MAESTRO_APP_ID ?? '', pushDeviceId);
if (pushServer != null) {
  process.env.MAESTRO_SIMULATOR_PUSH_URL = `http://${SIMULATOR_PUSH_HOST}:${SIMULATOR_PUSH_PORT}/push`;
}

const outputDir = join(OUTPUT_ROOT, new Date().toISOString().replaceAll(/[:.]/g, '-'));
// 푸시 입구가 흐름이 도는 동안 응답해야 해 spawnSync로 이벤트 루프를 막지 않는다
const maestro = spawn(
  'maestro',
  [
    'test',
    '--test-output-dir',
    outputDir,
    '--format',
    'HTML',
    '--output',
    join(outputDir, 'report.html'),
    ...process.argv.slice(2),
    WORKSPACE_DIR,
  ],
  { stdio: 'inherit' },
);
maestro.on('exit', (code) => {
  pushServer?.close();
  process.exit(code ?? 1);
});
