/**
 * 메모 모듈 공개 API
 *
 * Facade가 공개 계약이다. 외부(app.module)는 MemoModule만 소비하며,
 * MemoFacade는 모듈 내부 컨트롤러 전용으로 크로스 모듈 소비자는 없다.
 */

export { MemoFacade } from "./application/facades/memo.facade";
export { MemoModule } from "./memo.module";
