import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { DATABASE_ENTITIES } from './libs/database/src/entities';

dotenv.config();

const url = process.env.DATABASE_URL ?? '';

const dataSource = new DataSource({
  type: 'postgres',
  url,
  entities: [...DATABASE_ENTITIES],
  migrations: ['libs/database/migrations/*.{ts,js}'],
  synchronize: false,
  logging: false,
});

export default dataSource;

