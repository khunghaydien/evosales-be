import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text", { nullable: false })
  name: string;

  @Column("text", { name: "email", unique: true, nullable: false })
  email: string;

  @Column("text", { name: "password", nullable: false })
  password: string;

  @Column("timestamptz", { name: "created_at", default: () => "now()" })
  createdAt: Date;

  @Column("timestamptz", { name: "updated_at", default: () => "now()" })
  updatedAt: Date;

  @Column("timestamptz", { name: "deleted_at", nullable: true })
  deletedAt: Date;

  @Column("timestamptz", { name: "last_login", nullable: true })
  lastLogin: Date;
}
