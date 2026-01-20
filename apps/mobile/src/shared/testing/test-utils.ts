/**
 * 호환성을 위한 re-export
 * 기존 테스트 파일들이 @src/shared/testing/test-utils 경로로 import하므로
 * 이 파일을 통해 모든 export를 제공합니다.
 */
export {
  AllProvidersWrapper,
  createTestQueryClient,
  renderWithProviders,
  type TestDependencies,
} from './test-render';
