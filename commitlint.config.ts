import type { UserConfig } from '@commitlint/types';

/**
 * Commitlint Configuration
 *
 * @see https://commitlint.js.org
 * @see https://www.conventionalcommits.org
 *
 * Supported commit types:
 * - feat:     새로운 기능 추가
 * - fix:      버그 수정
 * - docs:     문서 변경
 * - refactor: 코드 리팩토링
 * - perf:     성능 개선
 * - test:     테스트 추가/수정
 * - ci:       CI/CD 설정 및 스크립트 변경
 * - chore:    기타 변경사항 (빌드 프로세스, 도구 설정 등)
 */
const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 한국어 커밋 메시지 허용을 위해 대소문자 제한 해제
    'subject-case': [0],
    // 허용된 커밋 타입 명시
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'ci', 'chore']],
  },
};

export default config;
