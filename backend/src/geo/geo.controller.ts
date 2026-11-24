import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  @Get('cep/:cep')
  async cep(@Param('cep') cep: string) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) throw new BadRequestException('CEP deve ter 8 dígitos.');

    let payload: { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error(`viacep ${response.status}`);
      payload = await response.json();
    } catch {
      throw new BadGatewayException('Não foi possível consultar o CEP agora.');
    }

    if (payload.erro) throw new NotFoundException('CEP não encontrado.');
    return {
      cep: digits,
      logradouro: payload.logradouro ?? '',
      bairro: payload.bairro ?? '',
      cidade: payload.localidade ?? '',
      uf: payload.uf ?? '',
    };
  }

  @Get('geocode')
  async geocode(@Query('q') q?: string) {
    const endereco = q?.trim() ?? '';
    if (endereco.length < 5) {
      throw new BadRequestException('Informe o endereço para localizar no mapa.');
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('q', endereco);

    let results: { lat: string; lon: string; display_name: string }[];
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'pt-BR',
          'User-Agent': 'rAPP-SaoCarlos/1.0 (painel administrativo)',
        },
      });
      if (!response.ok) throw new Error(`nominatim ${response.status}`);
      results = await response.json();
    } catch {
      throw new BadGatewayException('Não foi possível localizar o endereço agora.');
    }

    const found = results[0];
    if (!found) {
      throw new NotFoundException('Não encontramos esse endereço. Ajuste o pino no mapa.');
    }

    return {
      latitude: Number(found.lat),
      longitude: Number(found.lon),
      rotulo: found.display_name,
    };
  }
}
