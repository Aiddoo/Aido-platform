import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Post,
	Put,
	Query,
} from "@nestjs/common";
import { ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";

import {
	CursorPaginationDto,
	PaginationDto,
	PaginationService,
} from "@/common/pagination";
import {
	ApiCreatedResponse,
	ApiCursorPaginatedResponse,
	ApiDoc,
	ApiNotFoundError,
	ApiPaginatedResponse,
	ApiSuccessResponse,
} from "@/common/swagger";

import { CreateTodoDto, UpdateTodoDto } from "./dtos/request";
import { TodoResponseDto } from "./dtos/response";
import { TodoService } from "./todo.service";

@ApiTags("todos")
@Controller("todos")
export class TodoController {
	constructor(
		private readonly todoService: TodoService,
		private readonly paginationService: PaginationService,
	) {}

	@Get()
	@ApiDoc({ summary: "모든 Todo 조회 (오프셋 기반 페이지네이션)" })
	@ApiQuery({
		name: "page",
		required: false,
		type: Number,
		description: "페이지 번호 (기본: 1)",
	})
	@ApiQuery({
		name: "size",
		required: false,
		type: Number,
		description: "페이지 크기 (기본: 20, 최대: 100)",
	})
	@ApiPaginatedResponse({ type: TodoResponseDto })
	findAll(@Query() query: PaginationDto) {
		const normalizedPagination =
			this.paginationService.normalizePagination(query);
		return this.todoService.findAllPaginated(normalizedPagination);
	}

	@Get("cursor")
	@ApiDoc({ summary: "모든 Todo 조회 (커서 기반 페이지네이션)" })
	@ApiQuery({
		name: "cursor",
		required: false,
		type: Number,
		description: "커서 (마지막 아이템 ID)",
	})
	@ApiQuery({
		name: "size",
		required: false,
		type: Number,
		description: "페이지 크기 (기본: 20, 최대: 100)",
	})
	@ApiCursorPaginatedResponse({ type: TodoResponseDto })
	findAllCursor(@Query() query: CursorPaginationDto) {
		return this.todoService.findAllWithCursor(query);
	}

	@Get(":id")
	@ApiDoc({ summary: "Todo 상세 조회" })
	@ApiParam({ name: "id", type: Number })
	@ApiSuccessResponse({ type: TodoResponseDto })
	@ApiNotFoundError("TODO_NOT_FOUND")
	findById(@Param("id", ParseIntPipe) id: number) {
		return this.todoService.findById(id);
	}

	@Post()
	@ApiDoc({ summary: "Todo 생성" })
	@ApiCreatedResponse({ type: TodoResponseDto })
	create(@Body() dto: CreateTodoDto) {
		return this.todoService.create(dto);
	}

	@Put(":id")
	@ApiDoc({ summary: "Todo 수정" })
	@ApiParam({ name: "id", type: Number })
	@ApiSuccessResponse({ type: TodoResponseDto })
	@ApiNotFoundError("TODO_NOT_FOUND")
	update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTodoDto) {
		return this.todoService.update(id, dto);
	}

	@Delete(":id")
	@ApiDoc({ summary: "Todo 삭제" })
	@ApiParam({ name: "id", type: Number })
	@ApiSuccessResponse({ type: TodoResponseDto })
	@ApiNotFoundError("TODO_NOT_FOUND")
	delete(@Param("id", ParseIntPipe) id: number) {
		return this.todoService.delete(id);
	}
}
