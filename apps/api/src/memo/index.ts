/**
 * 메모 모듈 공개 API
 *
 * 외부(app.module)는 MemoModule만 소비한다. MemoFacade는 모듈 내부 컨트롤러
 * 전용이며 크로스 모듈 소비자는 없다.
 */

export { MemoModule } from "./memo.module";
