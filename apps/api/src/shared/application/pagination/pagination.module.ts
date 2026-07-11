import { Global, Module } from "@nestjs/common";
import { PaginationService } from "./services/pagination.service";

/**
 * Pagination 모듈
 * 페이지네이션 관련 유틸리티 제공
 */
@Global()
@Module({
	providers: [PaginationService],
	exports: [PaginationService],
})
export class PaginationModule {}
