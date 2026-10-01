import baseConfig from '@aido/vitest-config';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/**/*.spec.ts'],
      coverage: { include: ['src/**/*.ts'] },
    },
  }),
);
