import { Module } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import { createFileStore, FileStore } from './file-store';
import { FilesController } from './files.controller';
import { FilesJob } from './files.job';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController],
  providers: [
    { provide: FileStore, useFactory: () => createFileStore(loadEnv()) },
    FilesService,
    FilesJob,
  ],
  exports: [FilesService],
})
export class FilesModule {}
