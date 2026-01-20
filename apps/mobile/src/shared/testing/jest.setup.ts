/**
 * Jest setup file for mobile app tests.
 * This file runs after the test framework is installed but before tests run.
 */

import { __clearStore } from './mocks/expo-secure-store';

// Clear the mock secure store before each test for isolation
beforeEach(() => {
  __clearStore();
});

// Also clear after each test to ensure clean state
afterEach(() => {
  __clearStore();
});
