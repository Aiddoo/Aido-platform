import type { Request } from "express";

/** Express가 고른 경로 템플릿(`/v1/todos/:id`). 라우팅 전이거나 맞는 경로가 없으면 null이다. */
export function readRouteTemplate(request: Request): string | null {
  const route: unknown = request.route;
  return typeof route === "object" &&
    route != null &&
    "path" in route &&
    typeof route.path === "string"
    ? route.path
    : null;
}
