import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = String(request.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      throw new UnauthorizedException('Faça login para continuar.');
    }

    try {
      const payload = this.jwt.verify<AuthUser>(token);
      request.user = {
        sub: payload.sub,
        role: payload.role,
        email: payload.email,
        nome: payload.nome,
      } satisfies AuthUser;
      return true;
    } catch {
      throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    }
  }
}
