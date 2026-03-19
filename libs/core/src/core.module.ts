import { Module } from "@nestjs/common";
import { CoreService } from "./core.service";
import { PancakeApiService } from "./pancake/pancake-api.service";
import { PancakeSocketService } from "./pancake/pancake-socket.service";

@Module({
  providers: [CoreService, PancakeApiService, PancakeSocketService],
  exports: [CoreService, PancakeApiService, PancakeSocketService],
})
export class CoreModule {}
