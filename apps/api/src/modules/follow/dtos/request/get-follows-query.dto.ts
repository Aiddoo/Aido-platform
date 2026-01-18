/**
 * 친구/요청 목록 조회 쿼리 DTO
 */

import { getFollowsQuerySchema, getFriendsQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/** 친구/요청 목록 조회 기본 쿼리 */
export class GetFollowsQueryDto extends createZodDto(getFollowsQuerySchema) {}

/** 친구 목록 조회 쿼리 (검색 지원) */
export class GetFriendsQueryDto extends createZodDto(getFriendsQuerySchema) {}
