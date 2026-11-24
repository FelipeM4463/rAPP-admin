import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage, MulterError } from 'multer';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRepublicaDto, ListRepublicasQuery, ReorderFotosDto, UpdateRepublicaDto } from './dto';
import { RepublicasService } from './republicas.service';

@Catch(MulterError)
class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({ message: 'Cada foto pode ter no máximo 8 MB.' });
      return;
    }
    response.status(400).json({ message: 'Não foi possível receber as fotos.' });
  }
}

const fotoUpload = FilesInterceptor('fotos', 10, {
  storage: memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

@Controller()
@UseGuards(JwtAuthGuard)
export class RepublicasController {
  constructor(private readonly republicas: RepublicasService) {}

  @Get('tags')
  tags() {
    return this.republicas.tags();
  }

  @Get('pontos-referencia')
  pontos() {
    return this.republicas.pontos();
  }

  @Get('republicas')
  list(@Query() query: ListRepublicasQuery, @CurrentUser() user: AuthUser) {
    return this.republicas.list(query, user);
  }

  @Get('republicas/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return this.republicas.findOne(id, user);
  }

  @Post('republicas')
  create(@Body() body: CreateRepublicaDto, @CurrentUser() user: AuthUser) {
    return this.republicas.create(body, user);
  }

  @Patch('republicas/:id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateRepublicaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.republicas.update(id, body, user);
  }

  @Delete('republicas/:id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return this.republicas.remove(id, user);
  }

  @Post('republicas/:id/fotos')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(fotoUpload)
  addFotos(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.republicas.addFotos(id, files ?? [], user);
  }

  @Put('republicas/:id/fotos/ordem')
  reorder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReorderFotosDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.republicas.reorderFotos(id, body.ids, user);
  }

  @Patch('republicas/:id/fotos/:fotoId/principal')
  principal(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('fotoId', new ParseUUIDPipe()) fotoId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.republicas.setPrincipal(id, fotoId, user);
  }

  @Delete('republicas/:id/fotos/:fotoId')
  removeFoto(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('fotoId', new ParseUUIDPipe()) fotoId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.republicas.removeFoto(id, fotoId, user);
  }
}
