import { Module, Global } from '@nestjs/common';
import { StorageService, STORAGE_PROVIDER } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { StorageController } from './storage.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { envs } from '../config/envs';
@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [StorageController],
  providers: [
    StorageService,
    {
      provide: STORAGE_PROVIDER,
      useClass: envs.storageDriver === 's3' ? S3StorageProvider : LocalStorageProvider,
    },
  ],
  exports: [StorageService, STORAGE_PROVIDER],
})
export class StorageModule {}
