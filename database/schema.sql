-- rAPP São Carlos
-- Modelo relacional do diagrama de classes (UML 1.0) + insumos do PDD.
-- Classes: Republica, Localizacao, Foto, Tag, SessaoUsuario.
-- PontoReferencia persiste os pontos exigidos pelo PDD para o filtro de proximidade.
-- CEP entra em Localizacao porque o PDD exige endereço completo com CEP.

CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'st_setsrid') THEN
    RAISE EXCEPTION 'PostGIS não está disponível neste banco. O schema do rAPP depende de geometry, GIST e ST_Distance.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tag (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  categoria VARCHAR(40) NOT NULL
);

CREATE TABLE IF NOT EXISTS republica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  instagram VARCHAR(80) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  descricao TEXT NOT NULL,
  preco_mensal NUMERIC(10, 2) NOT NULL CHECK (preco_mensal >= 0),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS republica_email_uidx ON republica (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS republica_instagram_uidx ON republica (lower(instagram));

CREATE TABLE IF NOT EXISTS localizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  republica_id UUID NOT NULL UNIQUE REFERENCES republica (id) ON DELETE CASCADE,
  logradouro VARCHAR(200) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  bairro VARCHAR(120) NOT NULL,
  cep VARCHAR(8),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  geom geometry(Point, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS localizacao_geom_gix ON localizacao USING GIST (geom);

CREATE TABLE IF NOT EXISTS foto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  republica_id UUID NOT NULL REFERENCES republica (id) ON DELETE CASCADE,
  url_imagem TEXT NOT NULL,
  ordem INT NOT NULL CHECK (ordem >= 0),
  e_principal BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS foto_ordem_uidx ON foto (republica_id, ordem);
CREATE UNIQUE INDEX IF NOT EXISTS foto_principal_uidx ON foto (republica_id) WHERE e_principal;

CREATE TABLE IF NOT EXISTS republica_tag (
  republica_id UUID NOT NULL REFERENCES republica (id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tag (id),
  PRIMARY KEY (republica_id, tag_id)
);

CREATE TABLE IF NOT EXISTS sessao_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  republica_id UUID NOT NULL REFERENCES republica (id) ON DELETE CASCADE,
  refresh_token VARCHAR(512) NOT NULL UNIQUE,
  expira_em TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessao_usuario_republica_idx ON sessao_usuario (republica_id);

CREATE TABLE IF NOT EXISTS ponto_referencia (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(140) NOT NULL UNIQUE,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  geom geometry(Point, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS ponto_referencia_geom_gix ON ponto_referencia USING GIST (geom);

CREATE OR REPLACE FUNCTION localizacao_sync_geom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_localizacao_geom ON localizacao;
CREATE TRIGGER trg_localizacao_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON localizacao
FOR EACH ROW
EXECUTE FUNCTION localizacao_sync_geom();

CREATE OR REPLACE FUNCTION ponto_referencia_sync_geom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_referencia_geom ON ponto_referencia;
CREATE TRIGGER trg_ponto_referencia_geom
BEFORE INSERT OR UPDATE OF latitude, longitude ON ponto_referencia
FOR EACH ROW
EXECUTE FUNCTION ponto_referencia_sync_geom();

CREATE OR REPLACE FUNCTION republica_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_republica_touch ON republica;
CREATE TRIGGER trg_republica_touch
BEFORE UPDATE ON republica
FOR EACH ROW
EXECUTE FUNCTION republica_touch();

-- PDD: pelo menos uma tag de gênero (Mista, Feminina ou Masculina).
CREATE OR REPLACE FUNCTION republica_exige_genero()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rid UUID;
  n INT;
BEGIN
  rid := COALESCE(NEW.republica_id, OLD.republica_id);
  IF NOT EXISTS (SELECT 1 FROM republica WHERE id = rid) THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO n
  FROM republica_tag rt
  JOIN tag t ON t.id = rt.tag_id
  WHERE rt.republica_id = rid
    AND t.categoria = 'genero';

  IF n < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos uma tag de gênero: Mista, Feminina ou Masculina.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_republica_genero ON republica_tag;
CREATE CONSTRAINT TRIGGER trg_republica_genero
AFTER INSERT OR UPDATE OR DELETE ON republica_tag
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION republica_exige_genero();

-- PDD: no máximo 10 fotos por república.
CREATE OR REPLACE FUNCTION foto_limite_dez()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM foto WHERE republica_id = NEW.republica_id;
  IF n > 10 THEN
    RAISE EXCEPTION 'Uma república pode ter no máximo 10 fotos.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_foto_limite ON foto;
CREATE CONSTRAINT TRIGGER trg_foto_limite
AFTER INSERT ON foto
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION foto_limite_dez();

INSERT INTO tag (id, nome, categoria) VALUES
  (1, 'Almoço', 'refeicao'),
  (2, 'Jantar', 'refeicao'),
  (3, 'USP', 'universidade'),
  (4, 'UFSCar', 'universidade'),
  (5, 'Mista', 'genero'),
  (6, 'Feminina', 'genero'),
  (7, 'Masculina', 'genero'),
  (8, 'Faxineira', 'convivencia'),
  (9, 'Sem trote', 'convivencia'),
  (10, 'Faz festas', 'convivencia')
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome,
    categoria = EXCLUDED.categoria;

SELECT setval('tag_id_seq', (SELECT MAX(id) FROM tag));

INSERT INTO ponto_referencia (nome, latitude, longitude, geom) VALUES
  ('Campus USP Área 1', -22.005900, -47.898400, ST_SetSRID(ST_MakePoint(-47.898400, -22.005900), 4326)),
  ('Campus USP Área 2', -22.001800, -47.931300, ST_SetSRID(ST_MakePoint(-47.931300, -22.001800), 4326)),
  ('UFSCar Área Norte', -21.981000, -47.879000, ST_SetSRID(ST_MakePoint(-47.879000, -21.981000), 4326)),
  ('UFSCar Área Sul', -21.994000, -47.881500, ST_SetSRID(ST_MakePoint(-47.881500, -21.994000), 4326)),
  ('Centro / Praça XV', -22.017500, -47.890800, ST_SetSRID(ST_MakePoint(-47.890800, -22.017500), 4326)),
  ('Rodoviária de São Carlos', -22.019700, -47.888600, ST_SetSRID(ST_MakePoint(-47.888600, -22.019700), 4326))
ON CONFLICT (nome) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geom = EXCLUDED.geom;
