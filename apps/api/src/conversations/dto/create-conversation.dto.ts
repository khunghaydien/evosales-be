import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { ConversationStatus } from "@app/database/entities/conversation.entity";

export class CreateConversationDto {
  @IsString()
  pageId: string;

  @IsString()
  externalConversationId: string;

  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @IsOptional()
  @IsObject()
  orderInfo?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  shippingInfo?: Record<string, unknown>;
}
