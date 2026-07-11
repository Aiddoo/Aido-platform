import { Inject, Injectable, Logger } from "@nestjs/common";

import { PaginationService } from "@/shared/application/pagination";

import { normalizeUserSearchQuery } from "../../../domain/services/user-search-query";
import {
	FOLLOW_REPOSITORY,
	type FollowRepositoryPort,
	type UserSearchResult,
} from "../../ports/follow.repository.port";
import { decodeSearchCursor, encodeSearchCursor } from "./search-cursor";

/** 사용자 검색 입력 (정규화 전 원본 검색어). */
export interface SearchUsersInput {
	viewerId: string;
	query: string;
	cursor?: string;
	size?: number;
}

/** 사용자 검색 결과 (관련도 순 + 커서 페이지네이션). */
export interface SearchUsersOutput {
	items: UserSearchResult[];
	totalCount: number;
	hasMore: boolean;
	nextCursor: string | null;
}

/**
 * SearchUsersUseCase — 이름 또는 태그로 전체 활성 사용자 검색.
 *
 * 검색어를 NFC 정규화하고, 불투명 (rank,id) 커서를 디코딩해 keyset 페이지네이션한다.
 * 관계 flag는 저장소에서 단일 쿼리로 도출한다(N+1 없음).
 */
@Injectable()
export class SearchUsersUseCase {
	readonly #logger = new Logger(SearchUsersUseCase.name);

	constructor(
		@Inject(FOLLOW_REPOSITORY)
		private readonly followRepository: FollowRepositoryPort,
		private readonly paginationService: PaginationService,
	) {}

	async execute(input: SearchUsersInput): Promise<SearchUsersOutput> {
		const { nfc, upperTag } = normalizeUserSearchQuery(input.query);

		const { size } = this.paginationService.normalizeCursorPagination<string>({
			size: input.size,
		});

		const cursor =
			input.cursor != null ? decodeSearchCursor(input.cursor) : undefined;

		const [rows, totalCount] = await Promise.all([
			this.followRepository.searchUsers({
				viewerId: input.viewerId,
				nfcQuery: nfc,
				upperTag,
				cursor,
				size,
			}),
			this.followRepository.countSearchUsers({
				viewerId: input.viewerId,
				nfcQuery: nfc,
				upperTag,
			}),
		]);

		const hasMore = rows.length > size;
		const items = hasMore ? rows.slice(0, size) : rows;
		const last = items.at(-1);
		const nextCursor =
			hasMore && last != null
				? encodeSearchCursor({ rank: last.rank, id: last.id })
				: null;

		this.#logger.debug(
			`User search: ${items.length} items for viewer: ${input.viewerId}`,
		);

		return { items, totalCount, hasMore, nextCursor };
	}
}
