import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INVITE_LINK_BASE_URL } from '@aido/api/vocabulary';

import { LANDING_ORIGIN } from './landing-origin';

// app.config.ts는 src 값을 import하면 `expo config`가 깨져 글자로 읽어 대조한다
const APP_CONFIG_SOURCE = readFileSync(join(__dirname, '../../../app.config.ts'), 'utf8');

function readAppConfigString(name: string): string | undefined {
  return new RegExp(`const ${name} = '([^']*)';`).exec(APP_CONFIG_SOURCE)?.[1];
}

describe('랜딩 출처 계약', () => {
  it('앱 링크로 여는 호스트는 랜딩 출처의 호스트다', () => {
    // When
    const host = readAppConfigString('INVITE_LINK_HOST');

    // Then
    expect(host).toBe(new URL(LANDING_ORIGIN).host);
  });

  it('공유하는 초대 링크는 랜딩 출처에서 앱 링크 경로로 시작한다', () => {
    // When
    const pathPrefix = readAppConfigString('INVITE_LINK_PATH_PREFIX');

    // Then
    expect(`${INVITE_LINK_BASE_URL}/`).toBe(`${LANDING_ORIGIN}${pathPrefix}`);
  });
});
