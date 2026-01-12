import type { UserConfig } from '@commitlint/types';

/**
 * Commitlint Configuration
 *
 * @see https://commitlint.js.org
 * @see https://www.conventionalcommits.org
 *
 * Supported commit types (from @commitlint/config-conventional):
 * - feat:     새로운 기능 추가
 * - fix:      버그 수정
 * - docs:     문서 변경
 * - style:    코드 포맷팅 (세미콜론, 공백 등)
 * - refactor: 코드 리팩토링
 * - perf:     성능 개선
 * - test:     테스트 추가/수정
 * - build:    빌드 시스템, 외부 종속성 변경
 * - ci:       CI 설정 변경
 * - chore:    기타 변경사항
 * - revert:   커밋 되돌리기
 */
const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 한국어 커밋 메시지 허용을 위해 대소문자 제한 해제
    'subject-case': [0],
  },
};

export default config;
