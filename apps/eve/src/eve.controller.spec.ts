import { Test, TestingModule } from "@nestjs/testing";
import { EveController } from "./eve.controller";
import { EveService } from "./eve.service";

describe("EveController", () => {
  let eveController: EveController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [EveController],
      providers: [EveService],
    }).compile();

    eveController = app.get<EveController>(EveController);
  });
});
