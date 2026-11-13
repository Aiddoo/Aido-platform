import type { HttpStatus } from "./http-status.js";

/** 오류 코드 하나의 정의. message는 Swagger와 서버 기본 문구(합니다체)다. */
export interface ErrorDefinition {
  /** 도메인 접두사와 번호(`AUTH_0101`, `TODO_CATEGORY_0851`) */
  code: string;

  message: string;

  /** 개발자용 상세 설명 (디버깅 및 문서화 목적) */
  description: string;

  httpStatus: HttpStatus;
}
