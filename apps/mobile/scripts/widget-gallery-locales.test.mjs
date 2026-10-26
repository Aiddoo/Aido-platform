import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { getConfig } = require('expo/config');

const projectRoot = path.resolve(import.meta.dirname, '..');
const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: true });

// app.config는 홈 화면 이름을 환경별로 더하려고 locales를 파일 경로 대신 객체로 넘긴다
const readLocale = (language) => {
  const source = exp.locales[language];
  return typeof source === 'string'
    ? JSON.parse(readFileSync(path.join(projectRoot, source), 'utf8'))
    : source;
};
const ko = readLocale('ko');
const en = readLocale('en');
const HANGUL = /[가-힣]/;

const pluginWidgets = (name) => {
  const plugin = exp.plugins.find((entry) => Array.isArray(entry) && entry[0] === name);
  assert.ok(plugin, `${name} plugin`);
  return plugin[1].widgets;
};

test('iOS 위젯 이름·설명은 ko·en Localizable.strings 키이고 ko는 원문, en은 영어다', () => {
  const koStrings = ko.ios['Localizable.strings'];
  const enStrings = en.ios['Localizable.strings'];
  assert.deepEqual(Object.keys(enStrings).sort(), Object.keys(koStrings).sort());

  for (const widget of pluginWidgets('expo-widgets')) {
    for (const key of [widget.displayName, widget.description]) {
      assert.equal(koStrings[key], key);
      assert.ok(enStrings[key] && !HANGUL.test(enStrings[key]), `en: ${key}`);
    }
  }
});

test('iOS 첫 동기화 전 로그인 안내는 앱 카탈로그 위젯 문구를 en 키로 번역한다', () => {
  const readCatalog = (language) =>
    JSON.parse(
      readFileSync(
        path.join(projectRoot, `src/shared/i18n/locales/${language}/widget.json`),
        'utf8',
      ),
    ).state;
  const koCatalog = readCatalog('ko');
  const enCatalog = readCatalog('en');

  for (const key of ['loggedOutTitle', 'loggedOutCta']) {
    assert.equal(ko.ios['Localizable.strings'][enCatalog[key]], koCatalog[key]);
    assert.equal(en.ios['Localizable.strings'][enCatalog[key]], enCatalog[key]);
  }
});

test('Android 위젯 label·description은 ko·en에 모두 있는 문자열 리소스다', () => {
  assert.deepEqual(Object.keys(en.android).sort(), Object.keys(ko.android).sort());

  for (const widget of pluginWidgets('react-native-android-widget')) {
    const prefix = `widget_${widget.name.toLowerCase()}`;
    assert.equal(widget.label, `@string/${prefix}_label`);
    // 공식 plugin은 description이 있을 때만 android:description을 만든다
    assert.ok(widget.description);
    for (const key of [`${prefix}_label`, `${prefix}_description`]) {
      assert.ok(ko.android[key], `ko: ${key}`);
      assert.ok(en.android[key] && !HANGUL.test(en.android[key]), `en: ${key}`);
    }
  }
});

test('Android 기본 values/는 en 문자열로 채운다', () => {
  const fallback = exp.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === './plugins/withAndroidFallbackLocaleStrings',
  );
  assert.deepEqual(fallback?.[1], { locale: 'en' });
});
