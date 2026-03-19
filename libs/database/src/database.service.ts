import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class DatabaseService {
  constructor(@InjectDataSource() public readonly dataSource: DataSource) {}
}
