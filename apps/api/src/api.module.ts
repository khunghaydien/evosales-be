import { Module } from "@nestjs/common";
import { DatabaseModule } from "@app/database/database.module";
import { ApiController } from "./api.controller";
import { ApiService } from "./api.service";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { PagesModule } from "./pages/pages.module";
import { KnowledgeEmbeddingsModule } from "./knowledge-embeddings/knowledge-embeddings.module";
import { ConversationsModule } from "./conversations/conversations.module";

@Module({
  imports: [
    DatabaseModule.forRoot(),
    UsersModule,
    AuthModule,
    PagesModule,
    KnowledgeEmbeddingsModule,
    ConversationsModule,
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
