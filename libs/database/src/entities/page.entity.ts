import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserEntity } from "./user.entity";

@Entity("pages")
export class PageEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid", { name: "user_id" })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserEntity;

  @Column("text", { name: "page_id" })
  pageId: string;

  @Column("text", { name: "access_tokens", array: true })
  accessTokens: string[];

  @Column("text", { name: "sale_prompt", nullable: true })
  salePrompt: string | null;

  // Cấu hình điều kiện để chuyển trạng thái conversation sang shipping/ordered.
  // Ví dụ: { "required": ["phone", "address"] }
  @Column("jsonb", { name: "order_ship_config", nullable: true })
  orderShipConfig: Record<string, unknown> | null;

  // Ví dụ: { "required": ["quantity", "combo", "color"] }
  @Column("jsonb", { name: "order_collection_config", nullable: true })
  orderCollectionConfig: Record<string, unknown> | null;

  @Column("timestamptz", { name: "created_at", default: () => "now()" })
  createdAt: Date;

  @Column("timestamptz", { name: "updated_at", default: () => "now()" })
  updatedAt: Date;
}
