import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomBytes, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuthUser } from './auth.types';

type RepublicaRow = {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, senha: string) {
    const adminEmail = this.config.getOrThrow<string>('ADMIN_EMAIL').trim().toLowerCase();
    const adminPassword = this.config.getOrThrow<string>('ADMIN_PASSWORD');

    if (email === adminEmail && safeEqual(senha, adminPassword)) {
      const user: AuthUser = {
        sub: 'gestor',
        role: 'gestor',
        email: adminEmail,
        nome: 'Equipe rAPP',
      };
      return {
        accessToken: await this.jwt.signAsync(user),
        refreshToken: null,
        role: user.role,
        nome: user.nome,
        email: user.email,
        republicaId: null,
      };
    }

    const republica = await this.db.one<RepublicaRow>(
      `SELECT id, nome, email, senha_hash
       FROM republica
       WHERE lower(email) = $1`,
      [email],
    );

    const senhaOk = republica ? await bcrypt.compare(senha, republica.senha_hash) : false;
    if (!republica || !senhaOk) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const refreshToken = randomBytes(48).toString('hex');
    const days = Number(this.config.get<string>('JWT_REFRESH_DAYS') ?? 30);
    const expiraEm = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.db.query(
      `INSERT INTO sessao_usuario (republica_id, refresh_token, expira_em)
       VALUES ($1, $2, $3)`,
      [republica.id, refreshToken, expiraEm],
    );

    const user: AuthUser = {
      sub: republica.id,
      role: 'republica',
      email: republica.email,
      nome: republica.nome,
    };

    return {
      accessToken: await this.jwt.signAsync(user),
      refreshToken,
      role: user.role,
      nome: user.nome,
      email: user.email,
      republicaId: republica.id,
    };
  }

  async refresh(refreshToken: string) {
    const sessao = await this.db.one<{
      id: string;
      republica_id: string;
      expira_em: Date;
      nome: string;
      email: string;
    }>(
      `SELECT s.id, s.republica_id, s.expira_em, r.nome, r.email
       FROM sessao_usuario s
       JOIN republica r ON r.id = s.republica_id
       WHERE s.refresh_token = $1`,
      [refreshToken],
    );

    if (!sessao || new Date(sessao.expira_em).getTime() < Date.now()) {
      if (sessao) {
        await this.db.query(`DELETE FROM sessao_usuario WHERE id = $1`, [sessao.id]);
      }
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }

    const novoRefresh = randomBytes(48).toString('hex');
    const days = Number(this.config.get<string>('JWT_REFRESH_DAYS') ?? 30);
    const expiraEm = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.db.query(
      `UPDATE sessao_usuario SET refresh_token = $2, expira_em = $3 WHERE id = $1`,
      [sessao.id, novoRefresh, expiraEm],
    );

    const user: AuthUser = {
      sub: sessao.republica_id,
      role: 'republica',
      email: sessao.email,
      nome: sessao.nome,
    };

    return {
      accessToken: await this.jwt.signAsync(user),
      refreshToken: novoRefresh,
      role: user.role,
      nome: user.nome,
      email: user.email,
      republicaId: sessao.republica_id,
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.db.query(`DELETE FROM sessao_usuario WHERE refresh_token = $1`, [refreshToken]);
    }
    return { ok: true };
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
