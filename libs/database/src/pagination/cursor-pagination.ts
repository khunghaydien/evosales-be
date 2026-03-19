import { SelectQueryBuilder } from "typeorm";

export type CursorDirection = "ASC" | "DESC";

export interface Cursor {
  createdAt: string;
  id: string;
}

export interface CursorPaginationOptions<
  Entity extends { createdAt: any; id: any },
> {
  alias: string;
  limit: number;
  direction?: CursorDirection;
  cursor?: Cursor | null;
  searchTerm?: string | null;
  // dùng string để dễ truyền tên cột (kể cả alias khác)
  searchFields?: string[];
  filters?: Record<string, any>;
  whereBuilder?: (qb: SelectQueryBuilder<Entity>) => void;
}

export interface CursorPaginationResult<
  Entity extends { createdAt: any; id: any },
> {
  data: Entity[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: Cursor | null;
  };
}

export async function cursorPaginate<
  Entity extends { createdAt: any; id: any },
>(
  qb: SelectQueryBuilder<Entity>,
  options: CursorPaginationOptions<Entity>,
): Promise<CursorPaginationResult<Entity>> {
  const {
    alias,
    limit,
    direction = "DESC",
    cursor,
    searchTerm,
    searchFields = [],
    filters = {},
    whereBuilder,
  } = options;

  const orderDirection = direction.toUpperCase() === "ASC" ? "ASC" : "DESC";
  const take = Math.min(Math.max(limit, 1), 100);

  Object.entries(filters).forEach(([field, value], index) => {
    const paramName = `filter_${field}_${index}`;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      qb.andWhere(`${alias}.${field} IN (:...${paramName})`, {
        [paramName]: value,
      });
    } else if (value !== undefined && value !== null) {
      qb.andWhere(`${alias}.${field} = :${paramName}`, {
        [paramName]: value,
      });
    }
  });

  if (searchTerm && searchTerm.trim() && searchFields.length > 0) {
    const term = searchTerm.trim();

    qb.andWhere(
      searchFields
        .map((field, idx) => `${alias}.${String(field)} ILIKE :search_${idx}`)
        .join(" OR "),
      searchFields.reduce(
        (params, _field, idx) => {
          params[`search_${idx}`] = `%${term}%`;
          return params;
        },
        {} as Record<string, string>,
      ),
    );
  }

  if (whereBuilder) {
    whereBuilder(qb);
  }

  if (cursor?.createdAt && cursor?.id) {
    const op = orderDirection === "DESC" ? "<" : ">";
    qb.andWhere(
      `(${alias}.createdAt, ${alias}.id) ${op} (:cursorCreatedAt, :cursorId)`,
      {
        cursorCreatedAt: cursor.createdAt,
        cursorId: cursor.id,
      },
    );
  }

  qb.orderBy(`${alias}.createdAt`, orderDirection)
    .addOrderBy(`${alias}.id`, orderDirection)
    .take(take + 1);

  const rows = await qb.getMany();

  const hasNextPage = rows.length > take;
  const data = hasNextPage ? rows.slice(0, take) : rows;

  const last = data[data.length - 1] as any;

  const endCursor: Cursor | null =
    last && last.createdAt && last.id
      ? {
          createdAt: last.createdAt.toISOString?.() ?? String(last.createdAt),
          id: last.id,
        }
      : null;

  return {
    data,
    pageInfo: {
      hasNextPage,
      endCursor,
    },
  };
}
