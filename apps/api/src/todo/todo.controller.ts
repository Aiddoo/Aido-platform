import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTodoDto } from './dto/create-todo.dto';
import { TodoResponseDto } from './dto/todo-response.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoService } from './todo.service';

@ApiTags('todos')
@Controller('todos')
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Get()
  @ApiOperation({ summary: '모든 Todo 조회' })
  @ApiResponse({
    status: 200,
    description: 'Todo 목록',
    type: [TodoResponseDto],
  })
  findAll() {
    return this.todoService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Todo 상세 조회' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Todo 상세', type: TodoResponseDto })
  @ApiResponse({ status: 404, description: 'Todo를 찾을 수 없음' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.todoService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Todo 생성' })
  @ApiResponse({
    status: 201,
    description: 'Todo 생성됨',
    type: TodoResponseDto,
  })
  @ApiResponse({ status: 400, description: '유효성 검증 실패' })
  create(@Body() dto: CreateTodoDto) {
    return this.todoService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Todo 수정' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Todo 수정됨',
    type: TodoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Todo를 찾을 수 없음' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTodoDto) {
    return this.todoService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Todo 삭제' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Todo 삭제됨',
    type: TodoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Todo를 찾을 수 없음' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.todoService.delete(id);
  }
}
