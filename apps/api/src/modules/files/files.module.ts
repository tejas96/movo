import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesJob } from './files.job';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, FilesJob],
  exports: [FilesService],
})
export class FilesModule {}
