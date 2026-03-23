import { IsEnum, IsObject, IsOptional } from "class-validator";
import { ConversationStatus } from "@app/database/entities/conversation.entity";

export class UpdateConversationDto {
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
