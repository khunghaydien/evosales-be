import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { PageEntity } from "./page.entity";

export enum ConversationStatus {
  NEVER_MESSAGED = "never_messaged",
  ORDER_INFO_COLLECTED = "order_info_collected",
  SHIPPING_INFO_COLLECTED = "shipping_info_collected",
  SOLD = "sold",
}

@Entity("conversations")
@Index("IDX_conversations_page_id_status", ["pageId", "status"])
@Index(
  "UQ_conversations_page_id_external_id",
  ["pageId", "externalConversationId"],
  { unique: true },
)
export class ConversationEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid", { name: "page_id" })
  pageId: string;

  @ManyToOne(() => PageEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "page_id" })
  page: PageEntity;

  // id cuộc hội thoại từ nền tảng chat (Pancake/Facebook/...)
  @Column("text", { name: "external_conversation_id" })
  externalConversationId: string;

  @Column("enum", {
    enum: ConversationStatus,
    name: "status",
    default: ConversationStatus.NEVER_MESSAGED,
  })
  status: ConversationStatus;

  // Thông tin đơn hàng tổng quát: sản phẩm, số lượng, màu sắc, ...
  @Column("jsonb", { name: "order_info", nullable: true })
  orderInfo: Record<string, unknown> | null;

  // Thông tin giao hàng: sđt, địa chỉ, ghi chú giao hàng, ...
  @Column("jsonb", { name: "shipping_info", nullable: true })
  shippingInfo: Record<string, unknown> | null;

  @Column("timestamptz", { name: "created_at", default: () => "now()" })
  createdAt: Date;

  @Column("timestamptz", { name: "updated_at", default: () => "now()" })
  updatedAt: Date;
}
