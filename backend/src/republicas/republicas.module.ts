import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RepublicasController } from './republicas.controller';
import { RepublicasService } from './republicas.service';

@Module({
  imports: [AuthModule],
  controllers: [RepublicasController],
  providers: [RepublicasService],
})
export class RepublicasModule {}
