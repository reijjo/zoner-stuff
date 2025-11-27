import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationBootstrapOptions } from 'src/common/application-bootstrap-options.interface';
import { EVENT_STORE_CONNECTION } from './core.constants';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27018/vf-event-store', {
      connectionName: EVENT_STORE_CONNECTION,
      directConnection: true,
    }),
  ],
})
export class CoreModule {
  static forRoot(options: ApplicationBootstrapOptions) {
    const imports =
      options.driver === 'orm'
        ? [
            TypeOrmModule.forRootAsync({
              imports: [ConfigModule],
              inject: [ConfigService],
              useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get<string>('DATABASE_HOST'),
                port: configService.get<number>('DATABASE_PORT'),
                username: configService.get<string>('DATABASE_USERNAME'),
                password: configService.get<string>('DATABASE_PASSWORD') ?? '',
                database: configService.get<string>('DATABASE_NAME'),
                logging: true,
                autoLoadEntities: true,
                synchronize: true,
              }),
            }),
            MongooseModule.forRoot('mongodb://localhost:27017/vf-read-db'),
          ]
        : [];

    return {
      module: CoreModule,
      imports,
    };
  }
}
