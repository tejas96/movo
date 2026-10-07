import { FILE_MAX_BYTES, filesContract, UploadKindSchema } from '@movo/contracts';
import { Controller, Get, Param, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiException } from '../../common/errors/api.exception';
import { Route } from '../../common/route/route.decorator';
import { FilesService, type UploadedBlob } from './files.service';

@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Route(filesContract.upload)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: FILE_MAX_BYTES, files: 1 } }))
  upload(@UploadedFile() file: UploadedBlob | undefined, @Query('kind') kind?: string) {
    const parsed = UploadKindSchema.default('LISTING_IMAGE').safeParse(kind);
    if (!parsed.success) throw ApiException.badRequest('VALIDATION_FAILED', 'Unknown photo kind');
    return this.files.upload(file, parsed.data);
  }

  /** Public on purpose: the signature in the url is the permission. */
  @Get('/v1/files/:fileId')
  async get(
    @Param('fileId') fileId: string,
    @Query('e') e: string,
    @Query('s') s: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.files.read(fileId, e, s);
    if (!file) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Not found' });
      return;
    }
    res.setHeader('Content-Type', file.mime);
    // The link itself changes once a day, so a day of caching is safe.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(file.body);
  }
}
