import type {
  Char,
  TimestampString,
  TimestamptzString,
  Varchar,
} from "@prisma/orm-postgres/target/codec-types";
import {
  pgTimestampStoredText,
  pgTimestamptzStoredText,
} from "@prisma/orm-postgres/target/data-types";
import { z } from "zod";

/** Prisma 8의 길이 brand를 인프라 경계에서 검증한다. PostgreSQL의 문자 길이를 따른다. */
export function varchar<const Length extends number>(
  value: string,
  length: Length,
): Varchar<Length> {
  return z
    .custom<Varchar<Length>>(
      (candidate) => typeof candidate === "string" && Array.from(candidate).length <= length,
    )
    .parse(value);
}

export function char<const Length extends number>(value: string, length: Length): Char<Length> {
  return z
    .custom<Char<Length>>(
      (candidate) => typeof candidate === "string" && Array.from(candidate).length === length,
    )
    .parse(value);
}

/** timestamp without time zone을 기존 서버와 동일하게 UTC로 읽고 쓴다. */
export function databaseTimestamp(value: Date): TimestampString<3> {
  const text = pgTimestampStoredText(value.toISOString().slice(0, -1));
  return z
    .custom<TimestampString<3>>((candidate) => typeof candidate === "string" && candidate === text)
    .parse(text);
}

export function databaseDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function databaseTimestamptz(value: Date): TimestamptzString<3> {
  const text = pgTimestamptzStoredText(value.toISOString());
  return z
    .custom<TimestamptzString<3>>(
      (candidate) => typeof candidate === "string" && candidate === text,
    )
    .parse(text);
}

export function applicationTimestamptz(value: string): Date {
  return new Date(value);
}

export function applicationTimestamp(value: string): Date {
  return new Date(`${value}Z`);
}

export function applicationDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
