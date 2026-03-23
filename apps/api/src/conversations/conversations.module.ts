import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConversationEntity } from "@app/database/entities/conversation.entity";
import { PageEntity } from "@app/database/entities/page.entity";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [TypeOrmModule.forFeature([ConversationEntity, PageEntity])],
  providers: [ConversationsService],
  controllers: [ConversationsController],
})
export class ConversationsModule {}
