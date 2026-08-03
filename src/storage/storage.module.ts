import { Module, Global } from '@nestjs/common';
import { StorageService, STORAGE_PROVIDER } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { StorageController } from './storage.controller';
import { ScheduleModule } from '@nestjs/schedule';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [StorageController],
  providers: [
    StorageService,
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
