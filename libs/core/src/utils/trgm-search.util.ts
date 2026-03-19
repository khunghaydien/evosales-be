import type { SelectQueryBuilder } from "typeorm";

const DEFAULT_TRGM_THRESHOLD = 0.2;

export type TextSearchMode = "ilike" | "trgm";

/**
 * Thêm điều kiện search text vào QueryBuilder.
 *
 * - **ilike** (mặc định): dùng ILIKE '%term%', không cần extension, chạy được ngay.
 * - **trgm**: dùng similarity() (pg_trgm), search gần đúng tốt hơn.
 *   Cần bật: CREATE EXTENSION IF NOT EXISTS pg_trgm;
 *
 * @param qb - QueryBuilder (alias đã được set)
 * @param alias - Alias của bảng (vd: 'r')
 * @param columnName - Tên cột search (vd: 'name')
 * @param search - Chuỗi search (bỏ qua nếu empty)
 * @param paramName - Tên param để tránh trùng (mặc định 'searchTerm')
 * @param threshold - Ngưỡng similarity khi mode = 'trgm' (mặc định 0.2)
 * @param mode - 'ilike' = không cần pg_trgm, 'trgm' = cần bật extension
 */
export function addTrgmSearch(
  qb: SelectQueryBuilder<object>,
  alias: string,
  columnName: string,
  search: string | undefined,
  paramName = "searchTerm",
  threshold = DEFAULT_TRGM_THRESHOLD,
  mode: TextSearchMode = "ilike",
): void {
  const term = search?.trim();
  if (!term) return;
  const col = `${alias}.${columnName}`;
  if (mode === "trgm") {
    qb.andWhere(`similarity(${col}, :${paramName}) > :threshold`, {
      [paramName]: term,
      threshold,
    });
  } else {
    qb.andWhere(`${col} ILIKE :${paramName}`, {
      [paramName]: `%${term}%`,
    });
  }
}
