import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import sharp from 'sharp';
import { createS3Client, ensurePublicBucket, putFoto, s3ConfigFromEnv } from '../storage/s3';

loadEnv();

const samples = [
  {
    nome: 'República dos Ipês',
    email: 'ipes@republicas.rapp',
    instagram: 'republicadosipes',
    whatsapp: '16997001001',
    descricao:
      'Casa mista no Centro de São Carlos, perto da USP Área 1. Tem almoço e jantar nos dias de semana, cozinha aberta e quartos arejados para quem chega tarde da aula.',
    preco: 820,
    tags: ['Mista', 'Almoço', 'Jantar', 'USP'],
    local: {
      logradouro: 'Rua Episcopal',
      numero: '1420',
      bairro: 'Centro',
      cep: '13560049',
      latitude: -22.0168,
      longitude: -47.8912,
    },
    foto: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=70',
    cor: '#E07A3D',
  },
  {
    nome: 'República das Magnólias',
    email: 'magnolias@republicas.rapp',
    instagram: 'republicadasmagnolias',
    whatsapp: '16997001002',
    descricao:
      'República feminina, sem trote, com jantar servido durante a semana. A casa fica no caminho da UFSCar e recebe as moradoras com uma rotina mais calma.',
    preco: 760,
    tags: ['Feminina', 'Jantar', 'Sem trote', 'UFSCar'],
    local: {
      logradouro: 'Rua São Joaquim',
      numero: '890',
      bairro: 'Vila Prado',
      cep: '13574020',
      latitude: -22.0089,
      longitude: -47.8865,
    },
    foto: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=70',
    cor: '#C46B8A',
  },
  {
    nome: 'República Barão',
    email: 'barao@republicas.rapp',
    instagram: 'republicabarao',
    whatsapp: '16997001003',
    descricao:
      'Casa masculina próxima da USP, com almoço incluso e festas combinadas com a vizinhança. O preço cabe no orçamento do semestre e a sala fica aberta para estudar junto.',
    preco: 690,
    tags: ['Masculina', 'Faz festas', 'Almoço', 'USP'],
    local: {
      logradouro: 'Rua Sérgio Porto',
      numero: '310',
      bairro: 'Vila Pureza',
      cep: '13561020',
      latitude: -22.0215,
      longitude: -47.9042,
    },
    foto: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&q=70',
    cor: '#3E6B8A',
  },
  {
    nome: 'República Laranjeiras',
    email: 'laranjeiras@republicas.rapp',
    instagram: 'republicalaranjeiras',
    whatsapp: '16997001004',
    descricao:
      'República mista ao lado da USP Área 2, com faxineira e jantar. Os quartos são silenciosos durante a semana e a casa fica a uma caminhada curta do campus.',
    preco: 980,
    tags: ['Mista', 'Faxineira', 'Jantar', 'USP'],
    local: {
      logradouro: 'Avenida João Dagnone',
      numero: '450',
      bairro: 'Jardim Santa Angelina',
      cep: '13563120',
      latitude: -22.0042,
      longitude: -47.9255,
    },
    foto: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=70',
    cor: '#D9782D',
  },
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const schemaPath = join(process.cwd(), '..', 'database', 'schema.sql');
    await client.query(readFileSync(schemaPath, 'utf8'));

    const senhaHash = await bcrypt.hash('rep123456', 10);
    const s3Config = s3ConfigFromEnv();
    const s3 = createS3Client(s3Config);
    await ensurePublicBucket(s3, s3Config);

    for (const sample of samples) {
      const already = await client.query(`SELECT id FROM republica WHERE lower(email) = $1`, [sample.email]);
      if (already.rowCount) {
        console.log(`Já existia: ${sample.nome}`);
        continue;
      }
      const created = await client.query<{ id: string }>(
        `INSERT INTO republica (nome, email, senha_hash, instagram, whatsapp, descricao, preco_mensal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [sample.nome, sample.email, senhaHash, sample.instagram, sample.whatsapp, sample.descricao, sample.preco],
      );
      const id = created.rows[0].id;
      const local = sample.local;
      await client.query(
        `INSERT INTO localizacao (republica_id, logradouro, numero, bairro, cep, latitude, longitude, geom)
         VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($7, $6), 4326))`,
        [id, local.logradouro, local.numero, local.bairro, local.cep, local.latitude, local.longitude],
      );
      await client.query(
        `INSERT INTO republica_tag (republica_id, tag_id)
         SELECT $1, id FROM tag WHERE nome = ANY($2::text[])`,
        [id, sample.tags],
      );

      const image = await loadCover(sample.foto, sample.nome, sample.cor);
      const url = await putFoto(s3, s3Config, `${id}/capa.webp`, image);
      await client.query(
        `INSERT INTO foto (republica_id, url_imagem, ordem, e_principal)
         VALUES ($1, $2, 0, TRUE)`,
        [id, url],
      );
      console.log(`República cadastrada: ${sample.nome}`);
    }
  } finally {
    await client.end();
  }
}

async function loadCover(url: string, nome: string, cor: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'rAPP-SaoCarlos/1.0' },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const input = Buffer.from(await response.arrayBuffer());
    return await sharp(input)
      .rotate()
      .resize({ width: 1600, height: 1000, fit: 'cover' })
      .webp({ quality: 78 })
      .toBuffer();
  } catch (error) {
    console.warn(`Capa remota indisponível para ${nome}. Gerando imagem local.`, error);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${cor}"/>
          <stop offset="1" stop-color="#2A211C"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#g)"/>
      <text x="80" y="820" fill="white" font-size="64" font-family="sans-serif">${escapeXml(nome)}</text>
    </svg>`;
    return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
  }
}

function escapeXml(value: string) {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
}

function loadEnv() {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
