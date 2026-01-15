/**
 * NestJS DTO Entrypoint
 *
 * This module provides NestJS-compatible DTO classes created from Zod schemas.
 * Import from '@aido/validators/nestjs' to use these DTOs in NestJS applications.
 *
 * @example
 * import { LoginDto, AuthTokensDto } from '@aido/validators/nestjs';
 */

// Auth DTOs
export * from './domains/auth';

// Todo DTOs
export * from './domains/todo';
