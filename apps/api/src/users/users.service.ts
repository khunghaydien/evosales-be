import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { UserEntity } from "@app/database/entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async create(data: CreateUserDto): Promise<UserEntity> {
    const hash = await bcrypt.hash(data.password, 10);
    const user = this.usersRepo.create({
      name: data.name,
      email: data.email,
      password: hash,
    });
    return this.usersRepo.save(user);
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async update(id: string, data: UpdateUserDto): Promise<UserEntity> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (data.name !== undefined) {
      user.name = data.name;
    }
    if (data.password) {
      user.password = await bcrypt.hash(data.password, 10);
    }
    return this.usersRepo.save(user);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepo.delete(id);
  }
}
