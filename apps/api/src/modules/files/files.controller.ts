import { filesContract as c, FILE_MAX_BYTES, type RouteInput } from '@movo/contracts';
import { Controller, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiException } from '../../common/errors/api.exception';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { FilesService, type UploadedBlob } from './files.service';

type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;

@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Route(c.upload)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: FILE_MAX_BYTES, files: 1 } }))
  upload(@UploadedFile() file: UploadedBlob | undefined, @Input(c.upload) { query }: In<'upload'>) {
    return this.files.upload(file, query.kind);
  }

  /** Public on purpose: the signature in the url is the permission. Sends bytes, not JSON. */
  @Route(c.get)
  async get(@Input(c.get) { params, query }: In<'get'>, @Res() res: Response): Promise<void> {
    const file = await this.files.read(params.fileId, query.e, query.s);
    if (!file) throw ApiException.notFound();
    res.setHeader('Content-Type', file.mime);
    // The link itself changes once a day, so a day of caching is safe.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(file.body);
  }
}
