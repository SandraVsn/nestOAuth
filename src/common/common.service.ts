import { Dictionary, EntityRepository } from '@mikro-orm/core';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  LoggerService,
  NotFoundException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { isNull, isUndefined } from './utils/validation.util';

@Injectable()
export class CommonService {
  private readonly loggerService: LoggerService;

  constructor() {
    this.loggerService = new Logger(CommonService.name);
  }

  public async validateEntity(entity: Dictionary): Promise<void> {
    const errors = await validate(entity);
    const messages: string[] = [];

    for (const error of errors) {
      messages.push(...Object.values(error.constraints));
    }

    if (errors.length > 0) {
      throw new BadRequestException(messages.join(',\n'));
    }
  }

  public async throwDuplicateError<T>(promise: Promise<T>, message?: string) {
    try {
      return await promise;
    } catch (error) {
      this.loggerService.error(error);

      if (error.code === '23505') {
        throw new ConflictException(message ?? 'Duplicated value in database');
      }

      throw new BadRequestException(error.message);
    }
  }

  public async throwInternalError<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      this.loggerService.error(error);
      throw new InternalServerErrorException(error);
    }
  }

  public checkEntityExistence<T extends Dictionary>(
    entity: T | null | undefined,
    name: string,
  ): void {
    if (isNull(entity) || isUndefined(entity)) {
      throw new NotFoundException(`${name} not found`);
    }
  }

  public async saveEntity<T extends Dictionary>(
    repo: EntityRepository<T>,
    entity: T,
    isNew = false,
  ): Promise<void> {
    await this.validateEntity(entity);

    if (isNew) {
      repo.persist(entity);
    }

    await this.throwDuplicateError(repo.flush());
  }
}
