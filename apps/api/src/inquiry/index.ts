/**
 * Inquiry 모듈 공개 API
 *
 * 커맨드 클래스가 공개 계약(CommandBus 디스패치용), DTO는 컨트롤러 계약.
 */
export * from "./application/use-cases/create-inquiry/create-inquiry.command";
export * from "./inquiry.module";
export * from "./presentation/dtos";
