import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { StorageService } from './storage/storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async health() {
    const rows = await this.db.query<{ version: string }>('SELECT PostGIS_Version() AS version');
    await this.storage.client.send(new HeadBucketCommand({ Bucket: this.storage.config.bucket }));
    return {
      ok: true,
      postgis: rows[0]?.version ?? null,
      s3: {
        bucket: this.storage.config.bucket,
        endpoint: this.storage.config.endpoint,
      },
    };
  }
}
