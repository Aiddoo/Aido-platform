import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { addDensityConfigChange } = require('../plugins/withAndroidDensityConfigChange.js');

const TEMPLATE_CONFIG_CHANGES =
  'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths|locale|layoutDirection';

test('템플릿 configChanges를 그대로 두고 density만 더하며 prebuild를 반복해도 한 번만 넣는다', () => {
  const result = addDensityConfigChange(TEMPLATE_CONFIG_CHANGES);

  assert.equal(result, `${TEMPLATE_CONFIG_CHANGES}|density`);
  assert.equal(addDensityConfigChange(result), result);
});

test('configChanges가 없으면 density 하나만 둔다', () => {
  assert.equal(addDensityConfigChange(undefined), 'density');
});
