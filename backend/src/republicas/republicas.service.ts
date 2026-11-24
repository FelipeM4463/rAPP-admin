import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { rm, unlink } from 'fs/promises';
import { join } from 'path';
import { PoolClient } from 'pg';
import sharp from 'sharp';
import { AuthUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { CreateRepublicaDto, UpdateRepublicaDto } from './dto';

type RepublicaRow = {
  id: string;
  nome: string;
  email: string;
  instagram: string;
  whatsapp: string;
  descricao: string;
  preco_mensal: string;
  criado_em: Date;
  atualizado_em: Date;
  loc_id: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  distancia_metros: number | null;
  tags: { id: number; nome: string; categoria: string }[];
  fotos: { id: string; urlImagem: string; ordem: number; ePrincipal: boolean }[];
};

@Injectable()
export class RepublicasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  async list(
    filters: {
      q?: string;
      tagIds?: number[];
      precoMin?: number;
      precoMax?: number;
      lat?: number;
      lon?: number;
      ordenar?: 'nome' | 'recente' | 'distancia';
    },
    actor: AuthUser,
  ) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };

    if (filters.q?.trim()) {
      const term = add(likePattern(filters.q.trim()));
      where.push(`(
        unaccent(lower(r.nome)) ILIKE unaccent(lower(${term})) ESCAPE '\\'
        OR unaccent(lower(r.descricao)) ILIKE unaccent(lower(${term})) ESCAPE '\\'
        OR unaccent(lower(COALESCE(l.bairro, ''))) ILIKE unaccent(lower(${term})) ESCAPE '\\'
        OR unaccent(lower(r.instagram)) ILIKE unaccent(lower(${term})) ESCAPE '\\'
      )`);
    }

    if (filters.tagIds?.length) {
      const tagParam = add(filters.tagIds);
      where.push(`(
        SELECT COUNT(DISTINCT rt.tag_id)
        FROM republica_tag rt
        WHERE rt.republica_id = r.id
          AND rt.tag_id = ANY(${tagParam}::int[])
      ) = ${filters.tagIds.length}`);
    }

    if (filters.precoMin != null) where.push(`r.preco_mensal >= ${add(filters.precoMin)}`);
    if (filters.precoMax != null) where.push(`r.preco_mensal <= ${add(filters.precoMax)}`);

    let distanceSelect = 'NULL::float8 AS distancia_metros';
    let orderBy = 'r.nome ASC';
    if (filters.lat != null && filters.lon != null) {
      const lat = add(filters.lat);
      const lon = add(filters.lon);
      const point = `ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)`;
      distanceSelect = `CASE WHEN l.geom IS NULL THEN NULL ELSE ST_Distance(l.geom::geography, ${point}::geography) END AS distancia_metros`;
      if (filters.ordenar === 'distancia') {
        orderBy = `(l.geom IS NULL), l.geom <-> ${point}`;
      }
    }
    if (filters.ordenar === 'recente') orderBy = 'r.atualizado_em DESC';

    const rows = await this.db.query<RepublicaRow>(
      `${this.selectSql(distanceSelect)}
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY ${orderBy}`,
      params,
    );

    return {
      republicas: rows.map((row) => this.toDto(row, actor)),
      metricas: await this.metricas(),
    };
  }

  async findOne(id: string, actor: AuthUser) {
    const row = await this.db.one<RepublicaRow>(`${this.selectSql('NULL::float8 AS distancia_metros')} WHERE r.id = $1`, [id]);
    if (!row) throw new NotFoundException('República não encontrada.');
    return this.toDto(row, actor);
  }

  async create(dto: CreateRepublicaDto, actor: AuthUser) {
    if (actor.role !== 'gestor') {
      throw new ForbiddenException('Apenas a equipe gestora cadastra repúblicas no painel.');
    }
    this.assertReservedEmail(dto.email);
    const tagIds = await this.assertTags(dto.tagIds);
    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const id = await this.db.tx(async (client) => {
      try {
        const created = await this.db.one<{ id: string }>(
          `INSERT INTO republica (nome, email, senha_hash, instagram, whatsapp, descricao, preco_mensal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [dto.nome, dto.email, senhaHash, dto.instagram, dto.whatsapp, dto.descricao, dto.precoMensal],
          client,
        );
        const republicaId = created!.id;
        await this.upsertLocalizacao(client, republicaId, dto.localizacao);
        await this.replaceTags(client, republicaId, tagIds);
        return republicaId;
      } catch (error) {
        translatePg(error);
      }
    });

    return this.findOne(id, actor);
  }

  async update(id: string, dto: UpdateRepublicaDto, actor: AuthUser) {
    this.assertCanEdit(actor, id);
    await this.ensureExists(id);
    if (dto.email) this.assertReservedEmail(dto.email);
    const tagIds = dto.tagIds ? await this.assertTags(dto.tagIds) : null;
    const senhaHash = dto.senha ? await bcrypt.hash(dto.senha, 10) : null;

    await this.db.tx(async (client) => {
      const fields: string[] = [];
      const params: unknown[] = [];
      const add = (column: string, value: unknown) => {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      if (dto.nome != null) add('nome', dto.nome);
      if (dto.email != null) add('email', dto.email);
      if (senhaHash) add('senha_hash', senhaHash);
      if (dto.instagram != null) add('instagram', dto.instagram);
      if (dto.whatsapp != null) add('whatsapp', dto.whatsapp);
      if (dto.descricao != null) add('descricao', dto.descricao);
      if (dto.precoMensal != null) add('preco_mensal', dto.precoMensal);

      try {
        if (fields.length) {
          params.push(id);
          await this.db.query(
            `UPDATE republica SET ${fields.join(', ')} WHERE id = $${params.length}`,
            params,
            client,
          );
        }
        if (dto.localizacao) await this.upsertLocalizacao(client, id, dto.localizacao);
        if (tagIds) await this.replaceTags(client, id, tagIds);
        if (!fields.length) {
          await this.db.query(`UPDATE republica SET nome = nome WHERE id = $1`, [id], client);
        }
      } catch (error) {
        translatePg(error);
      }
    });

    return this.findOne(id, actor);
  }

  async remove(id: string, actor: AuthUser) {
    if (actor.role !== 'gestor') {
      throw new ForbiddenException('Apenas a equipe gestora pode excluir uma república.');
    }
    const existing = await this.db.one<{ id: string }>(`SELECT id FROM republica WHERE id = $1`, [id]);
    if (!existing) throw new NotFoundException('República não encontrada.');
    await this.db.query(`DELETE FROM republica WHERE id = $1`, [id]);
    await this.storage.removePrefix(`${id}/`);
    await rm(this.republicaDir(id), { recursive: true, force: true });
    return { ok: true };
  }

  async addFotos(id: string, files: Express.Multer.File[], actor: AuthUser) {
    this.assertCanEdit(actor, id);
    await this.ensureExists(id);
    if (!files?.length) throw new BadRequestException('Envie ao menos uma foto.');

    const saved: string[] = [];
    try {
      await this.db.tx(async (client) => {
        await this.db.query(`SELECT id FROM republica WHERE id = $1 FOR UPDATE`, [id], client);
        const current = await this.db.one<{ n: number; max_ordem: number | null; tem_principal: boolean }>(
          `SELECT COUNT(*)::int AS n,
                  MAX(ordem) AS max_ordem,
                  BOOL_OR(e_principal) AS tem_principal
           FROM foto
           WHERE republica_id = $1`,
          [id],
          client,
        );
        const total = current?.n ?? 0;
        if (total + files.length > 10) {
          throw new BadRequestException('Cada república pode ter no máximo 10 fotos.');
        }

        let ordem = (current?.max_ordem ?? -1) + 1;
        let hasPrincipal = Boolean(current?.tem_principal);

        for (const file of files) {
          if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
            throw new BadRequestException('Envie fotos JPG, PNG ou WebP.');
          }
          const filename = `${randomUUID()}.webp`;
          let buffer: Buffer;
          try {
            buffer = await sharp(file.buffer)
              .rotate()
              .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer();
          } catch {
            throw new BadRequestException('Não foi possível processar uma das fotos.');
          }
          const url = await this.storage.put(`${id}/${filename}`, buffer);
          saved.push(url);
          const ePrincipal = !hasPrincipal;
          await this.db.query(
            `INSERT INTO foto (republica_id, url_imagem, ordem, e_principal)
             VALUES ($1, $2, $3, $4)`,
            [id, url, ordem, ePrincipal],
            client,
          );
          if (ePrincipal) hasPrincipal = true;
          ordem += 1;
        }

        await this.db.query(`UPDATE republica SET nome = nome WHERE id = $1`, [id], client);
      });
    } catch (error) {
      await Promise.all(saved.map((url) => this.storage.removeUrl(url).catch(() => undefined)));
      translatePg(error);
    }

    return this.findOne(id, actor);
  }

  async reorderFotos(id: string, ids: string[], actor: AuthUser) {
    this.assertCanEdit(actor, id);
    const rows = await this.db.query<{ id: string }>(`SELECT id FROM foto WHERE republica_id = $1`, [id]);
    const current = new Set(rows.map((row) => row.id));
    if (current.size !== ids.length || ids.some((fotoId) => !current.has(fotoId))) {
      throw new BadRequestException('A ordem enviada não corresponde às fotos da república.');
    }

    await this.db.tx(async (client) => {
      for (let index = 0; index < ids.length; index += 1) {
        await this.db.query(
          `UPDATE foto SET ordem = $3 WHERE id = $1 AND republica_id = $2`,
          [ids[index], id, 1000 + index],
          client,
        );
      }
      for (let index = 0; index < ids.length; index += 1) {
        await this.db.query(
          `UPDATE foto SET ordem = $3 WHERE id = $1 AND republica_id = $2`,
          [ids[index], id, index],
          client,
        );
      }
      await this.db.query(`UPDATE republica SET nome = nome WHERE id = $1`, [id], client);
    });

    return this.findOne(id, actor);
  }

  async setPrincipal(id: string, fotoId: string, actor: AuthUser) {
    this.assertCanEdit(actor, id);
    const foto = await this.db.one(`SELECT id FROM foto WHERE id = $1 AND republica_id = $2`, [fotoId, id]);
    if (!foto) throw new NotFoundException('Foto não encontrada.');

    await this.db.tx(async (client) => {
      await this.db.query(`UPDATE foto SET e_principal = FALSE WHERE republica_id = $1`, [id], client);
      await this.db.query(
        `UPDATE foto SET e_principal = TRUE WHERE id = $1 AND republica_id = $2`,
        [fotoId, id],
        client,
      );
      await this.db.query(`UPDATE republica SET nome = nome WHERE id = $1`, [id], client);
    });

    return this.findOne(id, actor);
  }

  async removeFoto(id: string, fotoId: string, actor: AuthUser) {
    this.assertCanEdit(actor, id);
    const foto = await this.db.one<{ url_imagem: string; e_principal: boolean }>(
      `SELECT url_imagem, e_principal FROM foto WHERE id = $1 AND republica_id = $2`,
      [fotoId, id],
    );
    if (!foto) throw new NotFoundException('Foto não encontrada.');

    await this.db.tx(async (client) => {
      await this.db.query(`DELETE FROM foto WHERE id = $1`, [fotoId], client);
      if (foto.e_principal) {
        await this.db.query(
          `UPDATE foto SET e_principal = TRUE
           WHERE id = (
             SELECT id FROM foto WHERE republica_id = $1 ORDER BY ordem ASC LIMIT 1
           )`,
          [id],
          client,
        );
      }
      const remaining = await this.db.query<{ id: string }>(
        `SELECT id FROM foto WHERE republica_id = $1 ORDER BY ordem ASC`,
        [id],
        client,
      );
      for (let index = 0; index < remaining.length; index += 1) {
        await this.db.query(`UPDATE foto SET ordem = $2 WHERE id = $1`, [remaining[index].id, 1000 + index], client);
      }
      for (let index = 0; index < remaining.length; index += 1) {
        await this.db.query(`UPDATE foto SET ordem = $2 WHERE id = $1`, [remaining[index].id, index], client);
      }
      await this.db.query(`UPDATE republica SET nome = nome WHERE id = $1`, [id], client);
    });

    await this.storage.removeUrl(foto.url_imagem);
    if (foto.url_imagem.startsWith('/uploads/')) {
      const relative = foto.url_imagem.replace(/^\/uploads\//, '');
      await unlink(join(this.uploadRoot(), relative)).catch(() => undefined);
    }
    return this.findOne(id, actor);
  }

  tags() {
    return this.db.query<{ id: number; nome: string; categoria: string }>(
      `SELECT id, nome, categoria FROM tag ORDER BY categoria, nome`,
    );
  }

  pontos() {
    return this.db.query<{ id: number; nome: string; latitude: number; longitude: number }>(
      `SELECT id, nome, latitude, longitude FROM ponto_referencia ORDER BY nome`,
    );
  }

  private async metricas() {
    const row = await this.db.one<{
      total: number;
      preco_medio: string;
      com_fotos: number;
      sem_localizacao: number;
    }>(
      `SELECT COUNT(*)::int AS total,
              COALESCE(ROUND(AVG(preco_mensal), 0), 0)::text AS preco_medio,
              COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM foto f WHERE f.republica_id = r.id))::int AS com_fotos,
              COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM localizacao l WHERE l.republica_id = r.id))::int AS sem_localizacao
       FROM republica r`,
    );
    return {
      total: row?.total ?? 0,
      precoMedio: Number(row?.preco_medio ?? 0),
      comFotos: row?.com_fotos ?? 0,
      semLocalizacao: row?.sem_localizacao ?? 0,
    };
  }

  private selectSql(distanceSelect: string) {
    return `
      SELECT r.id, r.nome, r.email, r.instagram, r.whatsapp, r.descricao,
             r.preco_mensal, r.criado_em, r.atualizado_em,
             l.id AS loc_id, l.logradouro, l.numero, l.bairro, l.cep, l.latitude, l.longitude,
             ${distanceSelect},
             COALESCE(tg.tags, '[]'::json) AS tags,
             COALESCE(ft.fotos, '[]'::json) AS fotos
      FROM republica r
      LEFT JOIN localizacao l ON l.republica_id = r.id
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', t.id, 'nome', t.nome, 'categoria', t.categoria
        ) ORDER BY t.categoria, t.nome) AS tags
        FROM republica_tag rt
        JOIN tag t ON t.id = rt.tag_id
        WHERE rt.republica_id = r.id
      ) tg ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id', f.id, 'urlImagem', f.url_imagem, 'ordem', f.ordem, 'ePrincipal', f.e_principal
        ) ORDER BY f.ordem) AS fotos
        FROM foto f
        WHERE f.republica_id = r.id
      ) ft ON TRUE
    `;
  }

  private toDto(row: RepublicaRow, actor: AuthUser) {
    const own = actor.role === 'republica' && actor.sub === row.id;
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const fotos = Array.isArray(row.fotos) ? row.fotos : [];
    return {
      id: row.id,
      nome: row.nome,
      email: actor.role === 'gestor' || own ? row.email : undefined,
      instagram: row.instagram,
      whatsapp: row.whatsapp,
      descricao: row.descricao,
      precoMensal: Number(row.preco_mensal),
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em,
      distanciaMetros: row.distancia_metros == null ? null : Math.round(Number(row.distancia_metros)),
      localizacao: row.loc_id
        ? {
            id: row.loc_id,
            logradouro: row.logradouro,
            numero: row.numero,
            bairro: row.bairro,
            cep: row.cep,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
          }
        : null,
      tags,
      fotos,
    };
  }

  private async upsertLocalizacao(
    client: PoolClient,
    republicaId: string,
    localizacao: CreateRepublicaDto['localizacao'],
  ) {
    if (
      localizacao.latitude > -21.85 ||
      localizacao.latitude < -22.15 ||
      localizacao.longitude > -47.75 ||
      localizacao.longitude < -48.05
    ) {
      throw new BadRequestException('A localização precisa estar em São Carlos.');
    }

    await this.db.query(
      `INSERT INTO localizacao (republica_id, logradouro, numero, bairro, cep, latitude, longitude, geom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326))
       ON CONFLICT (republica_id) DO UPDATE
       SET logradouro = EXCLUDED.logradouro,
           numero = EXCLUDED.numero,
           bairro = EXCLUDED.bairro,
           cep = EXCLUDED.cep,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           geom = EXCLUDED.geom`,
      [
        republicaId,
        localizacao.logradouro,
        localizacao.numero,
        localizacao.bairro,
        localizacao.cep ?? null,
        localizacao.latitude,
        localizacao.longitude,
      ],
      client,
    );
  }

  private async replaceTags(client: PoolClient, republicaId: string, tagIds: number[]) {
    await this.db.query(`DELETE FROM republica_tag WHERE republica_id = $1`, [republicaId], client);
    for (const tagId of tagIds) {
      await this.db.query(
        `INSERT INTO republica_tag (republica_id, tag_id) VALUES ($1, $2)`,
        [republicaId, tagId],
        client,
      );
    }
  }

  private async assertTags(tagIds: number[]) {
    const unique = [...new Set(tagIds)];
    const rows = await this.db.query<{ id: number; categoria: string }>(
      `SELECT id, categoria FROM tag WHERE id = ANY($1::int[])`,
      [unique],
    );
    if (rows.length !== unique.length) {
      throw new BadRequestException('Há uma tag que não faz parte do catálogo do rAPP.');
    }
    if (!rows.some((row) => row.categoria === 'genero')) {
      throw new BadRequestException('Selecione ao menos uma tag de gênero: Mista, Feminina ou Masculina.');
    }
    return unique;
  }

  private assertCanEdit(actor: AuthUser, id: string) {
    if (actor.role === 'gestor') return;
    if (actor.role === 'republica' && actor.sub === id) return;
    throw new ForbiddenException('Você só pode editar a própria república.');
  }

  private assertReservedEmail(email: string) {
    const adminEmail = this.config.getOrThrow<string>('ADMIN_EMAIL').trim().toLowerCase();
    if (email === adminEmail) {
      throw new ConflictException('Este e-mail é reservado para a equipe gestora.');
    }
  }

  private async ensureExists(id: string) {
    const row = await this.db.one(`SELECT id FROM republica WHERE id = $1`, [id]);
    if (!row) throw new NotFoundException('República não encontrada.');
  }

  private uploadRoot() {
    return join(process.cwd(), this.config.get<string>('UPLOAD_DIR') ?? 'uploads');
  }

  private republicaDir(id: string) {
    return join(this.uploadRoot(), id);
  }
}

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function translatePg(error: unknown): never {
  const err = error as { code?: string; constraint?: string; message?: string };
  if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof NotFoundException) {
    throw error;
  }
  if (err.code === '23505') {
    const constraint = err.constraint ?? '';
    if (constraint.includes('email')) throw new ConflictException('Já existe uma república com este e-mail.');
    if (constraint.includes('instagram')) throw new ConflictException('Este Instagram já está cadastrado.');
    throw new ConflictException('Já existe um cadastro com estes dados.');
  }
  if (err.code === '23514') {
    const message = err.message ?? '';
    if (message.includes('gênero')) {
      throw new BadRequestException('Selecione ao menos uma tag de gênero: Mista, Feminina ou Masculina.');
    }
    if (message.includes('10 fotos')) {
      throw new BadRequestException('Uma república pode ter no máximo 10 fotos.');
    }
    throw new BadRequestException('Os dados não atendem às regras de cadastro.');
  }
  throw error;
}
