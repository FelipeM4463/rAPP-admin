import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LocalizacaoDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2, { message: 'Informe o logradouro.' })
  @MaxLength(200)
  logradouro!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1, { message: 'Informe o número.' })
  @MaxLength(20)
  numero!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2, { message: 'Informe o bairro.' })
  @MaxLength(120)
  bairro!: string;

  @Transform(({ value }) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    return digits || undefined;
  })
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'CEP deve ter 8 dígitos.' })
  cep?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Informe a latitude.' })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Informe a longitude.' })
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class CreateRepublicaDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2, { message: 'Informe o nome da república.' })
  @MaxLength(160)
  nome!: string;

  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres.' })
  @MaxLength(72)
  senha!: string;

  @Transform(({ value }) => normalizeInstagram(value))
  @Matches(/^[a-z0-9._]{2,30}$/, {
    message: 'Informe o Instagram sem espaços, apenas letras, números, ponto ou _.',
  })
  instagram!: string;

  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @Matches(/^\d{10,13}$/, { message: 'Informe o WhatsApp com DDD, só números.' })
  whatsapp!: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(10, { message: 'A descrição precisa contar um pouco mais sobre a casa.' })
  @MaxLength(2000)
  descricao!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe o preço mensal.' })
  @Min(0)
  @Max(20000)
  precoMensal!: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'Selecione ao menos a tag de gênero da república.' })
  @ArrayUnique()
  @IsInt({ each: true })
  tagIds!: number[];

  @ValidateNested()
  @Type(() => LocalizacaoDto)
  localizacao!: LocalizacaoDto;
}

export class UpdateRepublicaDto {
  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(2, { message: 'Informe o nome da república.' })
  @MaxLength(160)
  nome?: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres.' })
  @MaxLength(72)
  senha?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeInstagram(value))
  @Matches(/^[a-z0-9._]{2,30}$/, {
    message: 'Informe o Instagram sem espaços, apenas letras, números, ponto ou _.',
  })
  instagram?: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @Matches(/^\d{10,13}$/, { message: 'Informe o WhatsApp com DDD, só números.' })
  whatsapp?: string;

  @IsOptional()
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(10, { message: 'A descrição precisa contar um pouco mais sobre a casa.' })
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe o preço mensal.' })
  @Min(0)
  @Max(20000)
  precoMensal?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'Selecione ao menos a tag de gênero da república.' })
  @ArrayUnique()
  @IsInt({ each: true })
  tagIds?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizacaoDto)
  localizacao?: LocalizacaoDto;
}

export class ListRepublicasQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    const list = Array.isArray(value) ? value : String(value).split(',');
    const ids = list.map((item) => Number(item)).filter((item) => Number.isInteger(item));
    return ids.length ? ids : undefined;
  })
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precoMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lon?: number;

  @IsOptional()
  @IsIn(['nome', 'recente', 'distancia'])
  ordenar?: 'nome' | 'recente' | 'distancia';
}

export class ReorderFotosDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  ids!: string[];
}

export function normalizeInstagram(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}
