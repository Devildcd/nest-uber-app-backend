import { ApiResponseDto } from "../dto/api-response.dto";
import { PaginationMetaDto } from "../dto/pagination-meta.dto";

export const buildMeta = (total: number, page = 1, limit = 10): PaginationMetaDto => {
  const safePage  = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 10);
  const pageCount = Math.max(1, Math.ceil(total / safeLimit));
  const hasPrev   = safePage > 1;
  const hasNext   = safePage < pageCount;
  return {
    total,
    page: safePage,
    limit: safeLimit,
    pageCount,
    hasNext,
    hasPrev,
    nextPage: hasNext ? safePage + 1 : null,
    prevPage: hasPrev ? safePage - 1 : null,
  };
};

export function ok<T>(data: T, message = 'OK'): ApiResponseDto<T> {
  return { success: true, message, data };
}

export function paginated<T>(
  items: T[],
  total: number,
  page = 1,
  limit = 10,
  message = 'OK',
): ApiResponseDto<T[], PaginationMetaDto> {
  return { success: true, message, data: items, meta: buildMeta(total, page, limit) };
}

export function fail(
  message: string,
  code?: string,
  details?: any,
): ApiResponseDto<null> {
  return { success: false, message, error: { code, details } };
}