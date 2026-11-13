import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { removeDevLauncherLocalNetworkKeys } = require('../withoutDevLauncherLocalNetwork.js');

test('개발 도구가 넣은 로컬 네트워크 키만 지우고 다른 키는 그대로 둔다', () => {
  // Given
  const infoPlist = {
    CFBundleDisplayName: 'Aido',
    NSBonjourServices: ['_expo._tcp'],
    NSLocalNetworkUsageDescription: 'Expo Dev Launcher uses the local network.',
  };

  // When
  const result = removeDevLauncherLocalNetworkKeys(infoPlist);

  // Then
  assert.deepEqual(result, { CFBundleDisplayName: 'Aido' });
});

test('앱이 직접 넣은 서비스와 문구는 지우지 않는다', () => {
  // Given
  const infoPlist = {
    NSBonjourServices: ['_expo._tcp', '_aido._tcp'],
    NSLocalNetworkUsageDescription: 'Aido finds nearby devices.',
  };

  // When
  const result = removeDevLauncherLocalNetworkKeys(infoPlist);

  // Then
  assert.deepEqual(result, {
    NSBonjourServices: ['_aido._tcp'],
    NSLocalNetworkUsageDescription: 'Aido finds nearby devices.',
  });
});
