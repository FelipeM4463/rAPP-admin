import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { DatabaseService } from '../database/database.service';
import {
  S3Config,
  createS3Client,
  deleteFoto,
  deletePrefix,
  ensurePublicBucket,
  keyFromStoredUrl,
  putFoto,
  s3ConfigFromEnv,
} from './s3';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  readonly config: S3Config;
  readonly client: S3Client;

  constructor(
    configService: ConfigService,
    private readonly db: DatabaseService,
  ) {
    this.config = s3ConfigFromEnv({
      S3_ENDPOINT: configService.get<string>('S3_ENDPOINT'),
      S3_REGION: configService.get<string>('S3_REGION'),
      S3_BUCKET: configService.get<string>('S3_BUCKET'),
      S3_ACCESS_KEY: configService.get<string>('S3_ACCESS_KEY'),
      S3_SECRET_KEY: configService.get<string>('S3_SECRET_KEY'),
      S3_PUBLIC_URL: configService.get<string>('S3_PUBLIC_URL'),
    });
    this.client = createS3Client(this.config);
  }

  async onModuleInit() {
    await ensurePublicBucket(this.client, this.config);
    const moved = await this.migrateLocalUploads();
    if (moved) this.logger.log(`${moved} foto(s) enviada(s) do disco para o bucket ${this.config.bucket}.`);
  }

  async put(key: string, body: Buffer) {
    return putFoto(this.client, this.config, key, body);
  }

  async removeUrl(url: string) {
    await deleteFoto(this.client, this.config, url);
  }

  async removePrefix(prefix: string) {
    await deletePrefix(this.client, this.config, prefix);
  }

  private async migrateLocalUploads() {
    const rows = await this.db.query<{ id: string; url_imagem: string }>(
      `SELECT id, url_imagem FROM foto WHERE url_imagem LIKE '/uploads/%'`,
    );
    const uploadRoot = join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');
    let moved = 0;
    for (const row of rows) {
      const key = keyFromStoredUrl(this.config, row.url_imagem);
      if (!key) continue;
      try {
        const body = await readFile(join(uploadRoot, key));
        const url = await this.put(key, body);
        await this.db.query(`UPDATE foto SET url_imagem = $2 WHERE id = $1 AND url_imagem LIKE '/uploads/%'`, [
          row.id,
          url,
        ]);
        moved += 1;
      } catch (error) {
        this.logger.warn(`Foto ${row.id} continua em ${row.url_imagem}: ${(error as Error).message}`);
      }
    }
    return moved;
  }
}
