import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Cột `embedding` kiểu vector(1536) + ivfflat trong DB.
 * TypeORM không map vector native: dùng repository riêng (raw SQL) cho INSERT/search.
 */
@Entity("knowledge_embeddings")
export class KnowledgeEmbeddingEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("text", { name: "page_id", nullable: true })
  pageId!: string | null;

  @Column("text", { name: "chunk", nullable: false })
  chunk!: string;

  /**
   * Vector embedding lưu trong pgvector: vector(1536).
   * Ghi/đọc bằng raw SQL hoặc repository tuỳ bạn cấu hình.
   */
  @Column("vector", { name: "embedding", nullable: true })
  embedding!: number[] | null;

  // Không dùng repository.save — chỉ đọc metadata; embedding ghi bằng SQL vector
  embeddingDimensions = 1536 as const;
}
