import type { SelectQueryBuilder } from "typeorm";

export interface CursorPaginationParams {
  /** Alias của bảng (vd: 'r'). */
  alias: string;
  /** Tên bảng (vd: 'users'). */
  tableName: string;
  /** Cursor = id của item cuối trang trước. */
  cursor?: string;
  /** Số item mỗi trang (sẽ lấy limit+1 để xác định nextCursor). */
  limit: number;
  /** Tên cột thứ tự chính (mặc định updated_at). */
  orderColumn?: string;
  /** Tên cột break (mặc định id). */
  breakColumn?: string;
}

/**
 * Áp dụng order và điều kiện cursor lên QueryBuilder (index orderColumn + breakColumn).
 * Sau đó gọi .take(limit + 1) và .getMany(), rồi parse bằng parseCursorResult.
 */
export function addCursorPagination(
  qb: SelectQueryBuilder<object>,
  params: CursorPaginationParams,
): void {
  const {
    alias,
    tableName,
    cursor,
    limit,
    orderColumn = "updated_at",
    breakColumn = "id",
  } = params;

  const orderCol = `${alias}.${orderColumn}`;
  const breakCol = `${alias}.${breakColumn}`;
  qb.orderBy(orderCol, "DESC")
    .addOrderBy(breakCol, "DESC")
    .take(limit + 1);

  if (cursor?.trim()) {
    const subAlias = `${alias}_cursor`;
    qb.andWhere(
      `(${orderCol}, ${breakCol}) < (SELECT ${subAlias}.${orderColumn}, ${subAlias}.${breakColumn} FROM ${tableName} ${subAlias} WHERE ${subAlias}.${breakColumn} = :cursorId)`,
      { cursorId: cursor.trim() },
    );
  }
}

/**
 * Tách items và nextCursor từ mảng đã lấy (limit+1).
 * Nếu có thừa 1 phần tử thì đó là phần tử đầu trang sau → pop và lấy id phần tử cuối làm nextCursor.
 */
export function parseCursorResult<T extends { id: string }>(
  items: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  let nextCursor: string | null = null;
  if (items.length > limit) {
    items = items.slice(0, limit);
    nextCursor = items[items.length - 1]?.id ?? null;
  }
  return { items, nextCursor };
}
