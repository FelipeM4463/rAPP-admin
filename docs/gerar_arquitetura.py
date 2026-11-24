#!/usr/bin/env python3
"""Gera o PDF de arquitetura do painel administrativo do rAPP São Carlos."""

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Flowable,
    KeepTogether,
    ListFlowable,
    ListItem,
)

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
pdfmetrics.registerFont(TTFont("DejaVu", f"{FONT_DIR}/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuBold", f"{FONT_DIR}/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuOblique", f"{FONT_DIR}/DejaVuSans-Oblique.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuMono", f"{FONT_DIR}/DejaVuSansMono.ttf"))

INK = HexColor("#2A211C")
ORANGE = HexColor("#E85D2C")
CREAM = HexColor("#F3EEE6")
PAPER = HexColor("#FFFCF8")
LINE = HexColor("#E4D9CC")
MUTED = HexColor("#6B5E55")
ROW = HexColor("#F7F2EA")

PAGE_W, PAGE_H = A4
LEFT = 16 * mm
RIGHT = 16 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, PAGE_H - 26 * mm, PAGE_W, 26 * mm, fill=1, stroke=0)
    canvas.setFillColor(ORANGE)
    canvas.rect(0, PAGE_H - 26 * mm, 3.2 * mm, 26 * mm, fill=1, stroke=0)

    canvas.setFillColor(INK)
    canvas.setFont("DejaVuBold", 13)
    canvas.drawString(LEFT, PAGE_H - 12 * mm, "rAPP São Carlos")
    canvas.setFont("DejaVu", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(LEFT, PAGE_H - 17 * mm, "Documento de arquitetura do painel administrativo")

    meta = [
        ("CLIENTE", "Aplicativo de Repúblicas Estudantis de São Carlos (rAPP)"),
        ("DATA", "2026-11-24"),
        ("VERSÃO", "1.0"),
    ]
    y = PAGE_H - 9 * mm
    for label, value in meta:
        canvas.setFont("DejaVuBold", 7)
        canvas.setFillColor(ORANGE)
        canvas.drawString(118 * mm, y, label)
        canvas.setFont("DejaVu", 7)
        canvas.setFillColor(INK)
        canvas.drawString(136 * mm, y, value)
        y -= 4.2 * mm

    canvas.setStrokeColor(ORANGE)
    canvas.setLineWidth(1.1)
    canvas.line(LEFT, PAGE_H - 26 * mm, PAGE_W - RIGHT, PAGE_H - 26 * mm)

    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(LEFT, 12 * mm, PAGE_W - RIGHT, 12 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("DejaVu", 8)
    canvas.drawString(LEFT, 7.5 * mm, "Confidencial — rAPP São Carlos (2026)")
    canvas.drawRightString(PAGE_W - RIGHT, 7.5 * mm, f"Página {doc.page}")
    canvas.restoreState()


class Diagram(Flowable):
    def __init__(self, width):
        super().__init__()
        self.width = width
        self.height = 78 * mm

    def draw(self):
        c = self.canv

        def box(x, y, w, h, title, lines):
            c.setStrokeColor(ORANGE)
            c.setFillColor(PAPER)
            c.setLineWidth(1)
            c.roundRect(x, y, w, h, 3, fill=1, stroke=1)
            c.setFillColor(ORANGE)
            c.rect(x, y + h - 5.2 * mm, w, 5.2 * mm, fill=1, stroke=0)
            c.setFillColor(white)
            c.setFont("DejaVuBold", 7.5)
            c.drawString(x + 2.2 * mm, y + h - 3.6 * mm, title)
            c.setFillColor(INK)
            c.setFont("DejaVu", 7)
            yy = y + h - 9 * mm
            for line in lines:
                c.drawString(x + 2.2 * mm, yy, line)
                yy -= 3.4 * mm

        def arrow(x1, y, x2):
            c.setStrokeColor(INK)
            c.setFillColor(INK)
            c.setLineWidth(0.8)
            c.line(x1, y, x2 - 2.2 * mm, y)
            path = c.beginPath()
            path.moveTo(x2, y)
            path.lineTo(x2 - 2.4 * mm, y + 1.1 * mm)
            path.lineTo(x2 - 2.4 * mm, y - 1.1 * mm)
            path.close()
            c.drawPath(path, fill=1, stroke=0)

        bw = 52 * mm
        box(0, 28 * mm, bw, 28 * mm, "Navegador", ["React 18 + Vite", "http://127.0.0.1:5173", "Sessão no localStorage"])
        box(60 * mm, 28 * mm, bw, 28 * mm, "API NestJS", ["Prefixo /api", "http://127.0.0.1:3001", "JWT em toda rota de domínio"])
        box(120 * mm, 42 * mm, bw, 22 * mm, "PostgreSQL + PostGIS", ["127.0.0.1:5433 / banco rapp", "geometry(Point, 4326)"])
        box(120 * mm, 16 * mm, bw, 22 * mm, "MinIO (S3)", ["127.0.0.1:9000", "Bucket público rapp-fotos"])
        box(60 * mm, 0, bw, 20 * mm, "Serviços externos", ["ViaCEP  ·  Nominatim", "Chamados pela API"])

        arrow(bw, 42 * mm, 60 * mm)
        arrow(112 * mm, 52 * mm, 120 * mm)
        arrow(112 * mm, 30 * mm, 120 * mm)
        c.setStrokeColor(INK)
        c.setLineWidth(0.8)
        c.line(86 * mm, 28 * mm, 86 * mm, 20 * mm)


def styles():
    return {
        "h1": ParagraphStyle(
            "h1",
            fontName="DejaVuBold",
            fontSize=12.5,
            leading=16,
            textColor=INK,
            spaceBefore=4 * mm,
            spaceAfter=2.2 * mm,
        ),
        "h2": ParagraphStyle(
            "h2",
            fontName="DejaVuBold",
            fontSize=10.5,
            leading=14,
            textColor=ORANGE,
            spaceBefore=3 * mm,
            spaceAfter=1.4 * mm,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="DejaVu",
            fontSize=9,
            leading=12.4,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=1.8 * mm,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            fontName="DejaVu",
            fontSize=9,
            leading=12.2,
            textColor=INK,
            leftIndent=0,
        ),
        "th": ParagraphStyle(
            "th",
            fontName="DejaVuBold",
            fontSize=7.6,
            leading=9.6,
            textColor=white,
        ),
        "td": ParagraphStyle(
            "td",
            fontName="DejaVu",
            fontSize=7.6,
            leading=9.8,
            textColor=INK,
        ),
        "file": ParagraphStyle(
            "file",
            fontName="DejaVuMono",
            fontSize=7.2,
            leading=9.4,
            textColor=INK,
        ),
        "note": ParagraphStyle(
            "note",
            fontName="DejaVuOblique",
            fontSize=8,
            leading=11,
            textColor=MUTED,
            spaceBefore=1 * mm,
            spaceAfter=2 * mm,
        ),
    }


S = styles()


def P(text, style="body"):
    return Paragraph(text, S[style])


def bullets(items):
    flow = []
    for item in items:
        flow.append(
            ListFlowable(
                [ListItem(Paragraph(item, S["bullet"]), leftIndent=8, value="•")],
                bulletType="bullet",
                start="•",
                leftIndent=10,
                bulletFontName="DejaVu",
                bulletFontSize=8,
                spaceBefore=0,
                spaceAfter=0.6 * mm,
            )
        )
    return flow


def grid(headers, rows, widths):
    head = [Paragraph(cell, S["th"]) for cell in headers]
    body = []
    for row in rows:
        built = []
        for index, cell in enumerate(row):
            style = "file" if index == 0 and cell.startswith(("frontend", "backend", "database", "scripts", "docker", ".", "src")) else "td"
            if index == 0 and ("/" in cell or cell.endswith(".ts") or cell.endswith(".tsx") or cell.endswith(".sql") or cell.endswith(".sh") or cell.endswith(".css") or cell.endswith(".json") or cell.endswith(".yml")):
                style = "file"
            built.append(Paragraph(cell, S[style if index == 0 else "td"]))
        body.append(built)
    table = Table([head] + body, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), INK),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("BACKGROUND", (0, 1), (-1, -1), PAPER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, ROW]),
                ("FONTNAME", (0, 0), (-1, 0), "DejaVuBold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("GRID", (0, 0), (-1, -1), 0.3, LINE),
            ]
        )
    )
    return table


def section(title, blocks):
    return KeepTogether([P(title, "h1"), *blocks[:1]]) if False else [P(title, "h1"), *blocks]


def build():
    story = []
    story.append(P("Arquitetura do painel administrativo rAPP São Carlos", "h1"))
    story.append(
        P(
            "Este documento descreve a implementação do painel web que cadastra e gerencia as repúblicas estudantis de São Carlos. "
            "Ele segue o mesmo recorte do Documento de Definição de Processo e do modelo UML: o banco é compartilhado com o aplicativo, "
            "e o painel cobre somente a criação e a gestão das casas. O catálogo público do estudante, a moderação de anúncios e a aprovação de cadastros não fazem parte desta entrega."
        )
    )

    story.append(P("1. Título do documento", "h1"))
    story.append(
        P(
            "Arquitetura de software do painel administrativo do rAPP São Carlos: linguagens, bibliotecas, organização de pastas, "
            "responsabilidade dos arquivos e integração entre interface, API, PostgreSQL/PostGIS e armazenamento S3."
        )
    )

    story.append(P("2. Escopo e o que o painel faz", "h1"))
    story.append(
        P(
            "O painel é a interface da equipe gestora e da própria república. A gestora cria, edita e exclui qualquer casa. "
            "A conta da república entra com o mesmo e-mail gravado na tabela republica e altera somente a própria ficha, as tags, a localização e as fotos. "
            "Qualquer sessão autenticada enxerga o catálogo inteiro, inclusive as fotos. O objeto no bucket é público: quem tem a URL abre a imagem sem token."
        )
    )
    story.extend(
        bullets(
            [
                "Fora do escopo: aplicativo mobile do estudante, fila de aprovação, curadoria de denúncia e cálculo de rota por ruas. A distância usada é a geodésica do PostGIS, não o trajeto de carro.",
                "Dentro do escopo: login, busca com acento ignorado, filtro de tags em conjunto, faixa de preço, ordenação por nome, recência ou distância, mapa com pin arrastável, CEP, geocódigo e galeria de até dez fotos.",
                "O PostgreSQL é a fonte compartilhada. O aplicativo mobile, quando existir sobre este banco, lê as mesmas tabelas republica, localizacao, foto, tag, republica_tag, sessao_usuario e ponto_referencia.",
            ]
        )
    )

    story.append(P("3. Visão da arquitetura", "h1"))
    story.append(
        P(
            "O navegador não fala com o banco nem com o MinIO para gravar. Ele chama a API. A API valida o JWT, aplica as regras do PDD e persiste. "
            "As fotos saem do processo Nest já em WebP e entram no bucket por PutObject. A URL gravada em foto.url_imagem segue este formato:"
        )
    )
    story.append(P("http://127.0.0.1:9000/rapp-fotos/{republicaId}/{arquivo}.webp", "note"))
    story.append(Spacer(1, 1.5 * mm))
    story.append(Diagram(CONTENT_W))
    story.append(Spacer(1, 2 * mm))
    story.append(
        P(
            "O Vite, na porta 5173, encaminha /api e /uploads para a API na porta 3001. As imagens novas não passam por esse proxy: a tag img usa o endereço absoluto do MinIO. "
            "O prefixo /uploads permanece na API apenas para um arquivo que ainda não tenha sido migrado."
        )
    )
    story.append(P("Ordem de subida em scripts/dev.sh", "h2"))
    story.extend(
        bullets(
            [
                "scripts/pg.sh start sobe o cluster do usuário em 127.0.0.1:5433, com LD_LIBRARY_PATH, PROJ_LIB e GDAL_DATA apontando para o PostGIS extraído em ~/.local/share/rapp.",
                "scripts/s3.sh start sobe o binário do MinIO em ~/.local/bin/minio, com dados em ~/.local/share/rapp/s3, API em 127.0.0.1:9000 e console em 127.0.0.1:9001.",
                "npm run seed, a partir de backend/, aplica database/schema.sql e insere as quatro casas de exemplo se o e-mail ainda não existir. A capa vai direto para o bucket.",
                "A API Nest sobe em modo desenvolvimento e o Vite sobe em seguida. Os dois processos ficam no mesmo script até o encerramento.",
            ]
        )
    )

    story.append(P("4. Linguagens", "h1"))
    story.append(
        grid(
            ["Linguagem", "Onde entra", "Papel"],
            [
                ["TypeScript 5.7", "frontend/ e backend/src/", "Tipa componentes, DTOs, linhas do pg e o cliente S3. Os dois projetos compilam para JavaScript antes de rodar."],
                ["SQL", "database/schema.sql", "Define tabelas, índices, gatilhos e as cargas de tag e ponto de referência. O seed reaplica o arquivo inteiro, que é idempotente."],
                ["Bash", "scripts/", "Sobe Postgres e MinIO fora do Docker e encadeia seed, API e Vite."],
                ["CSS", "frontend/src/styles.css", "Visual do painel: fundo #f3eee6, marca #e85d2c, fonte Outfit, cartões, galeria e mapa."],
                ["HTML", "frontend/index.html", "Único documento. O Vite injeta o bundle em div#root."],
                ["SVG", "frontend/public/favicon.svg", "Ícone da aba. O seed também gera uma capa SVG quando a imagem remota não baixa."],
            ],
            [32 * mm, 48 * mm, CONTENT_W - 80 * mm],
        )
    )

    story.append(P("5. Frameworks e bibliotecas", "h1"))
    story.append(P("5.1 Interface", "h2"))
    story.append(
        P(
            "O frontend é uma aplicação de página única. Não há biblioteca de estado além do React. A sessão fica no contexto de autenticação e no localStorage. "
            "As chamadas HTTP usam fetch, centralizado em api.ts."
        )
    )
    story.append(
        grid(
            ["Pacote", "Versão", "Para que serve"],
            [
                ["react e react-dom", "18.3", "Renderizam a árvore. O ponto de entrada usa createRoot e StrictMode."],
                ["react-router-dom", "6.28", "Declara /login, /, /republicas/nova, /republicas/:id e /republicas/:id/editar. Rotas internas exigem sessão."],
                ["leaflet e react-leaflet", "1.9 e 4.2", "Mapa OSM, pin arrastável e círculos dos pontos de referência. O efeito de recentralizar depende só de flyKey, para o arraste não brigar com o flyTo."],
                ["vite e @vitejs/plugin-react", "6.0 e 4.3", "Servidor de desenvolvimento na porta 5173, proxy e build de produção."],
                ["typescript e @types/*", "5.7", "Checagem estática. O script de build do front roda tsc antes do Vite."],
            ],
            [48 * mm, 22 * mm, CONTENT_W - 70 * mm],
        )
    )
    story.append(P("5.2 API", "h2"))
    story.append(
        P(
            "O backend é um processo NestJS. O prefixo global é api. O ValidationPipe está com whitelist, transform e forbidNonWhitelisted: campo desconhecido no JSON vira erro, e o class-transformer converte query string em número."
        )
    )
    story.append(
        grid(
            ["Pacote", "Versão", "Para que serve"],
            [
                ["@nestjs/common, core, platform-express", "10.4", "Módulos, controladores, pipes, guards e o adaptador HTTP do Express."],
                ["@nestjs/config", "3.3", "Lê backend/.env. ConfigModule.forRoot é global."],
                ["@nestjs/jwt", "10.2", "Assina e verifica o access token. O segredo e o TTL vêm de JWT_SECRET e JWT_ACCESS_TTL."],
                ["class-validator e class-transformer", "0.14 e 0.5", "Regras dos DTOs de login, república, localização e reordenação de fotos."],
                ["pg", "8.13", "Pool de conexões. DatabaseService expõe query, one e transação com BEGIN/COMMIT."],
                ["bcryptjs", "2.4", "Hash da senha da república. A senha da gestora não vai para o banco: a comparação é timingSafeEqual com ADMIN_PASSWORD."],
                ["sharp", "0.33", "Gira a foto pela orientação EXIF, limita a 1920×1080 sem ampliar e grava WebP qualidade 80. A capa do seed usa 1600×1000 em cover, qualidade 78."],
                ["@aws-sdk/client-s3", "3.1176", "Cliente S3 com endpoint do MinIO, forcePathStyle e checksum só quando a operação exige. Cria o bucket, publica a política de leitura, envia, lista e apaga objetos."],
                ["rxjs e reflect-metadata", "7.8 e 0.2", "Infraestrutura do Nest. Não há fluxo reativo de negócio escrito à mão."],
                ["multer, via @nestjs/platform-express", "tipos 1.4", "FilesInterceptor guarda o upload em memória, no máximo dez arquivos de 8 MB. O filtro traduz LIMIT_FILE_SIZE para a mensagem de 8 MB."],
            ],
            [58 * mm, 28 * mm, CONTENT_W - 86 * mm],
        )
    )
    story.append(P("5.3 Dados, mapa e mídia", "h2"))
    story.append(
        grid(
            ["Peça", "Nesta máquina", "No compose", "Função"],
            [
                ["PostgreSQL", "14, porta 5433, usuário e banco rapp", "postgis/postgis:16-3.4", "Persiste o domínio. O schema não chama CREATE EXTENSION postgis neste cluster, porque o controle da extensão não está no sharedir do sistema. Ele exige que st_setsrid já exista."],
                ["PostGIS", "3.2, com PROJ e GDAL do diretório extraído", "3.4, já na imagem", "geometry(Point, 4326), índice GIST e ST_Distance em geography. A ordenação por distância usa o operador <->."],
                ["unaccent", "extensão do PostgreSQL do sistema", "a mesma, se o script criar", "A busca ignora acento em nome, descrição, bairro e Instagram."],
                ["MinIO", "RELEASE.2025-09-07T16-13-09Z, portas 9000 e 9001", "a mesma imagem", "API compatível com S3. A política do bucket permite s3:GetObject para qualquer principal. Gravação e exclusão usam a chave rapp."],
                ["ViaCEP", "https://viacep.com.br/ws/{cep}/json/", "igual", "Devolve logradouro, bairro, cidade e UF. O painel só aceita o pin se a cidade for São Carlos."],
                ["Nominatim", "consulta com User-Agent rAPP-SaoCarlos/1.0", "igual", "Transforma o endereço em latitude e longitude. Se a frase completa vier vazia, o formulário tenta a rua e depois o bairro, sempre com São Carlos."],
            ],
            [24 * mm, 42 * mm, 36 * mm, CONTENT_W - 102 * mm],
        )
    )

    story.append(P("6. Organização de pastas", "h1"))
    story.append(
        P(
            "A raiz não é um monorepo com workspaces do npm. Cada lado tem o próprio package.json. node_modules e dist existem depois do install e do build e não entram no desenho abaixo. "
            "O diretório backend/uploads guarda as capas que o seed antigo gravou em disco. Na subida, StorageService envia para o bucket toda linha de foto cuja URL ainda começa com /uploads/."
        )
    )
    story.append(
        grid(
            ["Caminho", "O que guarda"],
            [
                ["frontend/", "Aplicação React. index.html, vite.config.ts, tsconfig.json e public/favicon.svg ficam na raiz deste lado."],
                ["frontend/src/pages/", "As quatro telas: login, catálogo, detalhe e formulário de criar ou editar."],
                ["frontend/src/components/", "Casca do painel, cartão, mapa e diálogo de confirmação."],
                ["backend/src/auth/", "Login, refresh, logout, guarda JWT e o decorador que lê o usuário do request."],
                ["backend/src/republicas/", "Controlador, serviço e DTOs do cadastro, da busca e da galeria."],
                ["backend/src/database/", "Pool do pg e o seed. O SQL em si não mora aqui."],
                ["backend/src/geo/", "Consulta de CEP e geocódigo."],
                ["backend/src/storage/", "Cliente S3, política do bucket e a migração das fotos locais."],
                ["database/schema.sql", "Modelo relacional único, usado pelo cluster local e montado no compose como zz-schema.sql para rodar depois do script de init do PostGIS."],
                ["scripts/", "pg.sh, s3.sh e dev.sh."],
                ["backend/.env", "Segredos e portas locais. O exemplo versionável é backend/.env.example. O .gitignore exclui .env."],
                ["docker-compose.yml", "Caminho alternativo, quando o Docker existe: Postgres 16 com PostGIS 3.4 e o mesmo MinIO."],
                ["README.md", "Como subir nesta máquina, a diferença de versão do Postgres e os acessos de desenvolvimento."],
            ],
            [42 * mm, CONTENT_W - 42 * mm],
        )
    )
    story.append(P("Árvore dos arquivos de código", "h2"))
    story.append(
        P(
            "frontend/src/main.tsx, App.tsx, auth.tsx, api.ts, types.ts, format.ts, styles.css, vite-env.d.ts. "
            "Páginas: LoginPage, CatalogPage, DetailPage, FormPage. Componentes: Shell, RepublicaCard, MapView, Confirm. "
            "backend/src/main.ts, app.module.ts, health.controller.ts. "
            "auth: auth.module, auth.controller, auth.service, auth.types, dto, jwt-auth.guard, current-user.decorator. "
            "republicas: republicas.module, republicas.controller, republicas.service, dto. "
            "database: database.module, database.service, seed. geo: geo.module, geo.controller. "
            "storage: storage.module, storage.service, s3."
        )
    )

    story.append(P("7. Arquivos do frontend", "h1"))
    story.append(
        P(
            "O visual segue o recorte do aplicativo: fundo bege, marca laranja “Rapp.”, busca, filtros em pílula, cartão com foto, preço e selo de gênero. "
            "A fonte de tela é a Outfit, carregada no CSS. Não há estado global de repúblicas: cada página busca de novo quando o filtro muda."
        )
    )
    story.append(
        grid(
            ["Arquivo", "O que faz"],
            [
                ["frontend/index.html", "Documento único. Define o título “Rapp. · Painel de repúblicas”, o favicon e o nó root."],
                ["frontend/vite.config.ts", "Liga o plugin React, fixa a porta 5173 e faz proxy de /api e /uploads para 127.0.0.1:3001. Assim o navegador trata a API como mesma origem durante o desenvolvimento."],
                ["frontend/src/main.tsx", "Monta a árvore: StrictMode, BrowserRouter, AuthProvider e o CSS do Leaflet antes do CSS do painel."],
                ["frontend/src/App.tsx", "PrivateLayout manda quem não tem sessão para /login. As rotas autenticadas são o catálogo, a criação, o detalhe e a edição. Login fica fora da casca."],
                ["frontend/src/auth.tsx", "Contexto com login e logout. A sessão é o JSON devolvido pela API: accessToken, refreshToken, role, nome, email e republicaId. Login de gestora traz refreshToken nulo."],
                ["frontend/src/api.ts", "Única função de HTTP. Coloca Authorization: Bearer, define JSON quando o corpo não é FormData e, em 401, tenta /api/auth/refresh uma vez. Sem refresh, limpa a sessão e vai para /login. Mensagens de erro vêm do campo message da API."],
                ["frontend/src/types.ts", "Contratos Republica, Foto, Tag, Localizacao, Metricas, PontoReferencia e Session. O e-mail é opcional no tipo porque a API só o devolve para a gestora ou para a dona da casa."],
                ["frontend/src/format.ts", "Preço em real, CEP, telefone, links wa.me e instagram.com, capa principal e separação entre a tag de gênero e as demais."],
                ["frontend/src/styles.css", "Tokens visuais, topbar, cartões, galeria, formulário, mapa e o estado vazio da capa. O pin do Leaflet é um divIcon da classe pin."],
                ["frontend/src/pages/LoginPage.tsx", "Formulário de e-mail e senha. Se já existe sessão, redireciona: a república cai na própria ficha e a gestora cai no catálogo."],
                ["frontend/src/pages/CatalogPage.tsx", "Busca com debounce de 250 ms, tags em modo E (todas as selecionadas precisam existir na casa), faixas de preço até 700, de 700 a 1000 e acima de 1000. Mostra total, preço médio, casas com foto e casas sem localização. Só a gestora vê “Nova república” e o botão de excluir."],
                ["frontend/src/pages/DetailPage.tsx", "Galeria com capa e miniaturas, preço, tags, descrição, WhatsApp com saudação, Instagram, mapa e pontos de referência. Editar aparece para a gestora e para a dona. Excluir só para a gestora, depois de um Confirm."],
                ["frontend/src/pages/FormPage.tsx", "Um formulário serve para criar e editar. Consulta o CEP, tenta três frases no geocódigo e solta o pin. O gênero é um rádio: Mista, Feminina ou Masculina. As outras tags são múltiplas. Na edição, a foto sobe na hora. Na criação, o envio das fotos acontece depois que a casa ganha id. Há reordenação, capa e exclusão de foto."],
                ["frontend/src/components/Shell.tsx", "Barra com a marca, o papel (“Equipe gestora” ou “República”), o nome e Sair. Sair chama /api/auth/logout e, no caso da república, apaga o refresh em sessao_usuario."],
                ["frontend/src/components/RepublicaCard.tsx", "Capa, selo de gênero, bairro, até três tags de facilidade, preço e as ações que o catálogo autorizou."],
                ["frontend/src/components/MapView.tsx", "MapContainer, tile OSM, marcador arrastável e CircleMarker dos campi. Recenter observa flyKey, não a latitude, para não desfazer o arraste."],
                ["frontend/src/components/Confirm.tsx", "Diálogo usado antes de excluir a república."],
            ],
            [52 * mm, CONTENT_W - 52 * mm],
        )
    )

    story.append(P("8. Arquivos do backend", "h1"))
    story.append(P("8.1 Arranque e saúde", "h2"))
    story.append(
        grid(
            ["Arquivo", "O que faz"],
            [
                ["backend/src/main.ts", "Cria a aplicação Express, prefixo api, CORS para localhost:5173 e 127.0.0.1:5173, ValidationPipe e o estático de UPLOAD_DIR em /uploads. A porta padrão é 3001 porque 3000 já estava ocupada nesta máquina."],
                ["backend/src/app.module.ts", "Importa Config, Database, Storage, Auth, Republicas e Geo. O controlador de saúde fica neste módulo."],
                ["backend/src/health.controller.ts", "GET /api/health devolve ok, a string de PostGIS_Version() e o bucket com o endpoint S3. HeadBucket confirma que o MinIO responde com a credencial da API."],
                ["backend/nest-cli.json e tsconfig*.json", "Compilação CommonJS para backend/dist, com decorators e strict. O seed entra no build para npm run seed executar dist/database/seed.js."],
            ],
            [52 * mm, CONTENT_W - 52 * mm],
        )
    )
    story.append(P("8.2 Autenticação", "h2"))
    story.append(
        P(
            "Existem dois papéis no token: gestor e republica. A gestora não é uma linha do banco, para o schema continuar igual ao UML. "
            "O e-mail gestor@rapp.com, vindo de ADMIN_EMAIL, é reservado e não pode ser usado no cadastro de uma casa. "
            "A república autentica com bcrypt sobre senha_hash. O login dela grava um refresh de 48 bytes em hexadecimal em sessao_usuario, com validade JWT_REFRESH_DAYS. Cada refresh troca o token. O logout apaga a linha."
        )
    )
    story.append(
        grid(
            ["Arquivo", "O que faz"],
            [
                ["backend/src/auth/auth.controller.ts", "POST /api/auth/login, /refresh e /logout. GET /api/auth/me exige JWT e devolve id, papel, e-mail, nome e republicaId."],
                ["backend/src/auth/auth.service.ts", "Decide se a credencial é da gestora ou de uma casa. A gestora recebe sub gestor. A casa recebe sub igual ao UUID. Traduz e-mail e senha ausentes em 401."],
                ["backend/src/auth/jwt-auth.guard.ts", "Lê Authorization, verifica o JWT e coloca em request.user o objeto AuthUser: sub, role, email, nome."],
                ["backend/src/auth/current-user.decorator.ts", "Atalho @CurrentUser() para os controladores."],
                ["backend/src/auth/dto.ts", "LoginDto normaliza o e-mail. RefreshDto exige um token com pelo menos 20 caracteres. LogoutDto torna o refresh opcional, porque a gestora não tem um."],
                ["backend/src/auth/auth.types.ts", "UserRole e AuthUser."],
                ["backend/src/auth/auth.module.ts", "Registra JwtModule e exporta o guard para os outros módulos."],
            ],
            [58 * mm, CONTENT_W - 58 * mm],
        )
    )
    story.append(P("8.3 Repúblicas", "h2"))
    story.append(
        P(
            "RepublicasController está inteiro sob JwtAuthGuard. Criar e excluir a casa exigem papel gestor. Editar ficha, tags, localização e fotos exige gestor ou sub igual ao id da casa. "
            "A listagem não esconde foto de ninguém: o JSON traz urlImagem de todas as casas para qualquer sessão válida."
        )
    )
    story.append(
        grid(
            ["Rota", "Efeito"],
            [
                ["GET /api/tags", "Catálogo fixo de tags, ordenado por categoria e nome."],
                ["GET /api/pontos-referencia", "Os seis pontos do PDD, com latitude e longitude."],
                ["GET /api/republicas", "Lista com q, tagIds, precoMin, precoMax, lat, lon e ordenar (nome, recente ou distancia). A resposta inclui metricas."],
                ["GET /api/republicas/:id", "Ficha completa. 404 se o UUID não existe."],
                ["POST /api/republicas", "Cria casa, localização e tags na mesma transação. Só a gestora."],
                ["PATCH /api/republicas/:id", "Atualização parcial. Senha nova é hasheada. Tags, quando vêm, substituem o conjunto."],
                ["DELETE /api/republicas/:id", "Apaga a casa. O CASCADE leva localização, fotos, tags e sessões. Em seguida o serviço apaga o prefixo {id}/ no bucket e a pasta local restante."],
                ["POST /api/republicas/:id/fotos", "Campo fotos, até dez arquivos. Recusa o que não for JPEG, PNG ou WebP e o que estouraria o limite de dez."],
                ["PUT /api/republicas/:id/fotos/ordem", "Reordena em duas passagens (ordem temporária a partir de 1000, depois 0..n) por causa do índice único de ordem."],
                ["PATCH .../fotos/:fotoId/principal", "Uma capa por casa. O índice parcial único em e_principal garante isso no banco."],
                ["DELETE .../fotos/:fotoId", "Remove a linha, promove a primeira restante se a excluída era a capa, recompacta a ordem e apaga o objeto."],
            ],
            [58 * mm, CONTENT_W - 58 * mm],
        )
    )
    story.append(
        grid(
            ["Arquivo", "O que faz"],
            [
                ["republicas.controller.ts", "Traduz HTTP em chamada de serviço. O filtro de Multer responde 413 acima de 8 MB."],
                ["republicas.service.ts", "Monta o SELECT com joins laterais de tags e fotos. A busca usa unaccent e ILIKE com escape de % e _. Tags usam contagem distinta igual ao tamanho da lista, ou seja, E lógico. Com lat e lon, calcula ST_Distance em metros. ordenar=distancia ordena por l.geom <-> ponto. O bbox de São Carlos recusa latitude fora de -22,15 a -21,85 e longitude fora de -48,05 a -47,75. Erros 23505 viram conflito de e-mail ou Instagram. Erros 23514 viram a mensagem de gênero ou de dez fotos."],
                ["republicas/dto.ts", "CreateRepublicaDto e UpdateRepublicaDto exigem nome, contato, descrição, preço e, na criação, senha, localização e ao menos uma tag. ReorderFotosDto exige a lista de ids."],
                ["republicas.module.ts", "Liga controlador e serviço e importa Auth para usar o guard."],
            ],
            [42 * mm, CONTENT_W - 42 * mm],
        )
    )
    story.append(P("8.4 Geografia, banco e armazenamento", "h2"))
    story.append(
        grid(
            ["Arquivo", "O que faz"],
            [
                ["backend/src/geo/geo.controller.ts", "GET /api/geo/cep/:cep exige oito dígitos e consulta o ViaCEP. GET /api/geo/geocode?q= consulta o Nominatim e devolve candidatos dentro da área útil. As duas rotas exigem JWT. Falha de rede vira 502."],
                ["backend/src/database/database.service.ts", "Pool com DATABASE_URL. Na subida executa SELECT 1. query devolve linhas, one devolve a primeira ou null, tx abre um cliente e faz rollback se o callback lançar."],
                ["backend/src/database/database.module.ts", "Módulo global. Qualquer serviço injeta o pool sem importar de novo."],
                ["backend/src/database/seed.ts", "Lê o .env sem sobrescrever variável já definida, aplica schema.sql, e para cada casa de exemplo que ainda não existe grava república, localização, tags e a capa no S3. A senha de exemplo é rep123456. Se o download da capa falha, gera um WebP a partir de um SVG com o nome da casa."],
                ["backend/src/storage/s3.ts", "Funções sem Nest: configuração a partir do ambiente, cliente com path-style, ensurePublicBucket, putFoto, deleteFoto, deletePrefix e keyFromStoredUrl. A URL pública padrão é {S3_ENDPOINT}/{S3_BUCKET}."],
                ["backend/src/storage/storage.service.ts", "Na subida garante o bucket e a política de leitura anônima, depois migra fotos /uploads/. put, removeUrl e removePrefix são o que o serviço de repúblicas chama."],
                ["backend/src/storage/storage.module.ts", "Módulo global, para saúde, repúblicas e o ciclo de vida enxergarem o mesmo cliente."],
            ],
            [58 * mm, CONTENT_W - 58 * mm],
        )
    )

    story.append(P("9. Banco de dados", "h1"))
    story.append(
        P(
            "database/schema.sql materializa o diagrama de classes e os insumos do PDD que não eram classe: CEP e ponto de referência. "
            "Nomes de tabela e coluna estão em português, snake_case. O arquivo pode rodar mais de uma vez."
        )
    )
    story.append(
        grid(
            ["Tabela", "Relação e colunas que importam"],
            [
                ["republica", "Raiz. UUID, nome, e-mail e Instagram únicos em minúsculas, senha_hash, whatsapp, descricao, preco_mensal não negativo, criado_em e atualizado_em. O gatilho trg_republica_touch atualiza atualizado_em em todo UPDATE."],
                ["localizacao", "Um para um com a casa, ON DELETE CASCADE. logradouro, numero, bairro, cep de até 8 caracteres, latitude, longitude e geom geometry(Point, 4326). Índice GIST. trg_localizacao_geom recalcula o ponto antes de inserir ou mudar a coordenada."],
                ["foto", "Muitas por casa. url_imagem, ordem não negativa e e_principal. Índice único de (republica_id, ordem) e índice único parcial de uma capa. trg_foto_limite, adiado ao fim da transação, recusa a décima primeira foto."],
                ["tag", "Catálogo. id serial, nome único, categoria. As dez linhas iniciais cobrem refeição, universidade, gênero e convivência."],
                ["republica_tag", "N para N. Chave primária composta. trg_republica_genero, também adiado, exige ao menos uma tag de categoria genero. Se a casa já foi apagada, o gatilho não bloqueia o CASCADE."],
                ["sessao_usuario", "Refresh da república. republica_id, refresh_token único e expira_em. A gestora não grava sessão."],
                ["ponto_referencia", "Nome único, coordenada e geom com GIST. trg_ponto_referencia_geom mantém o ponto alinhado à latitude. A carga traz USP Área 1, USP Área 2, UFSCar Norte, UFSCar Sul, Centro/Praça XV e Rodoviária."],
            ],
            [36 * mm, CONTENT_W - 36 * mm],
        )
    )
    story.append(P("Tags carregadas com id fixo", "h2"))
    story.append(
        grid(
            ["Id", "Nome", "Categoria"],
            [
                ["1", "Almoço", "refeicao"],
                ["2", "Jantar", "refeicao"],
                ["3", "USP", "universidade"],
                ["4", "UFSCar", "universidade"],
                ["5", "Mista", "genero"],
                ["6", "Feminina", "genero"],
                ["7", "Masculina", "genero"],
                ["8", "Faxineira", "convivencia"],
                ["9", "Sem trote", "convivencia"],
                ["10", "Faz festas", "convivencia"],
            ],
            [18 * mm, 40 * mm, 40 * mm],
        )
    )
    story.append(
        P(
            "No formulário o gênero é exclusivo. A API aceita o contrato do banco, que é “pelo menos uma” tag de gênero. "
            "As demais tags do filtro do catálogo são cumulativas: pedir Feminina e UFSCar devolve só as casas que têm as duas.",
            "note",
        )
    )

    story.append(P("10. Quem pode o quê", "h1"))
    story.append(
        grid(
            ["Ação", "Gestora", "República autenticada", "Sem sessão"],
            [
                ["Ver catálogo, ficha, tags, pontos e fotos", "Sim", "Sim, de todas as casas", "Não. A API responde 401."],
                ["Abrir a URL da imagem no MinIO", "Sim", "Sim", "Sim. A política do bucket é leitura pública. A URL não é segredo."],
                ["Criar ou excluir república", "Sim", "Não", "Não"],
                ["Editar ficha, mapa, tags e fotos", "Qualquer casa", "Somente a própria", "Não"],
                ["Ver o e-mail da casa", "Todos", "Só o da própria", "Não"],
                ["Usar o e-mail da gestora numa casa", "O cadastro recusa", "O cadastro recusa", "Não"],
            ],
            [52 * mm, 32 * mm, 48 * mm, CONTENT_W - 132 * mm],
        )
    )

    story.append(P("11. Variáveis de ambiente", "h1"))
    story.append(
        P(
            "backend/.env.example lista os nomes. Os valores reais ficam em backend/.env, que não deve ser commitado. "
            "O documento não reproduz o segredo JWT."
        )
    )
    story.append(
        grid(
            ["Variável", "Função"],
            [
                ["PORT", "Porta da API. O exemplo usa 3001."],
                ["DATABASE_URL", "Conexão do pg. O exemplo aponta para postgresql://rapp:rapp@127.0.0.1:5433/rapp."],
                ["JWT_SECRET", "Chave de assinatura do access token. Trocar fora desta máquina."],
                ["JWT_ACCESS_TTL", "Validade do access token. O exemplo usa 8h."],
                ["JWT_REFRESH_DAYS", "Validade do refresh da república. O exemplo usa 30 dias."],
                ["ADMIN_EMAIL e ADMIN_PASSWORD", "Credencial da gestora, só no ambiente. Também reservam o e-mail contra o cadastro de uma casa."],
                ["UPLOAD_DIR", "Pasta relativa ao cwd do backend para o resquício local. O exemplo usa uploads."],
                ["S3_ENDPOINT", "Origem do MinIO. O exemplo usa http://127.0.0.1:9000."],
                ["S3_REGION", "Região exigida pelo SDK. O exemplo usa us-east-1. No MinIO local o valor é convencional."],
                ["S3_BUCKET", "Nome do bucket. O exemplo usa rapp-fotos."],
                ["S3_ACCESS_KEY e S3_SECRET_KEY", "Raiz do MinIO. A senha precisa ter pelo menos 8 caracteres. O exemplo usa rapp e rapp-secret."],
                ["S3_PUBLIC_URL", "Prefixo gravado em foto.url_imagem. O exemplo usa http://127.0.0.1:9000/rapp-fotos."],
            ],
            [52 * mm, CONTENT_W - 52 * mm],
        )
    )

    story.append(P("12. Scripts e Docker", "h1"))
    story.append(
        grid(
            ["Arquivo", "O que faz"],
            [
                ["scripts/pg.sh", "start, stop e status do cluster em ~/.local/share/rapp/pgdata. Exporta as bibliotecas do PostGIS antes de chamar pg_ctl. Não cria o cluster: se o diretório não existir, o script explica e sai."],
                ["scripts/s3.sh", "start, stop e status. Se a porta 9000 já responde em /minio/health/live, não sobe outro processo. O log fica em ~/.local/share/rapp/minio.log."],
                ["scripts/dev.sh", "Sobe banco e MinIO, instala dependências se node_modules não existir, roda o seed e deixa API e Vite em primeiro plano até o sinal de saída."],
                ["docker-compose.yml", "Serviço db com a imagem pedida no diagrama de componentes e o schema montado em docker-entrypoint-initdb.d/zz-schema.sql, para o init do PostGIS rodar primeiro. Serviço minio com as mesmas portas e a mesma credencial de desenvolvimento. Volumes rapp_pg e rapp_s3."],
                ["README.md", "Registra que esta máquina está em PostgreSQL 14 e PostGIS 3.2 porque não há Docker nem o pacote do PostgreSQL 16, e que o schema usa os mesmos recursos pedidos: ponto 4326, GIST e ST_Distance."],
                [".gitignore", "Ignora node_modules, dist, o conteúdo de backend/uploads exceto .gitkeep, .env, logs e .pgdata."],
            ],
            [40 * mm, CONTENT_W - 40 * mm],
        )
    )

    story.append(P("13. Fluxos que atravessam as camadas", "h1"))
    story.append(P("13.1 Entrar", "h2"))
    story.append(
        P(
            "LoginPage envia e-mail e senha para POST /api/auth/login. AuthService compara primeiro com a gestora. Se não for ela, busca republica pelo e-mail em minúsculas e confere o bcrypt. "
            "O token da gestora não gera linha em sessao_usuario. O token da casa gera. api.ts guarda o JSON. A partir daí toda chamada leva o Bearer. "
            "Quando o access token expira, só a casa consegue renovar, porque só ela tem refreshToken."
        )
    )
    story.append(P("13.2 Cadastrar uma casa", "h2"))
    story.append(
        P(
            "A gestora preenche FormPage. O CEP passa por GET /api/geo/cep. O botão de localizar monta até três consultas ao Nominatim. O pin pode ser arrastado, e a coordenada final precisa cair no retângulo de São Carlos. "
            "POST /api/republicas grava a casa, a localização e as tags numa transação. O gatilho adiado de gênero só aceita o commit se houver tag Mista, Feminina ou Masculina. "
            "Se o formulário trouxe arquivos, um segundo POST manda o FormData para /fotos. Sharp produz o WebP, o S3 recebe o objeto e a primeira foto da casa vira capa."
        )
    )
    story.append(P("13.3 Buscar e ordenar por distância", "h2"))
    story.append(
        P(
            "CatalogPage monta a query string. RepublicasService acrescenta um CASE com ST_Distance entre l.geom::geography e o ponto do observador quando lat e lon vêm na requisição. "
            "Os pontos de referência do detalhe e do mapa são os mesmos seis registros de ponto_referencia. A distância exibida é arredondada em metros. Casas sem geometria ficam no fim quando a ordem é por distância."
        )
    )
    story.append(P("13.4 Trocar a galeria", "h2"))
    story.append(
        P(
            "O envio recusa tipo inválido antes de gravar. Se a transação falha depois de um PutObject, o serviço apaga os objetos que acabou de criar. "
            "Definir capa zera e_principal da casa e liga a foto escolhida. Excluir a capa promove a de menor ordem. Excluir a casa apaga o prefixo inteiro no bucket, não só a linha."
        )
    )

    story.append(P("14. O que este documento não altera", "h1"))
    story.append(
        P(
            "O painel descrito aqui é o que está no repositório na data do cabeçalho. A modelagem pede PostgreSQL 16 e PostGIS 3.4. "
            "O compose já aponta essa imagem. O processo que atende 127.0.0.1:5433 nesta máquina é o 14 com PostGIS 3.2, com o mesmo SQL. "
            "Subir os dois ao mesmo tempo na porta 5433 não é o desenho: ou se usa o cluster local, ou se aponta DATABASE_URL para o container."
        )
    )

    output = "/home/felipe/Documentos/rAPP (desktop)/docs/arquitetura-painel-rapp-sao-carlos.pdf"
    doc = BaseDocTemplate(
        output,
        pagesize=A4,
        title="Arquitetura do painel administrativo rAPP São Carlos",
        author="rAPP São Carlos",
        subject="Arquitetura do painel web de gestão de repúblicas",
    )
    frame = Frame(
        LEFT,
        16 * mm,
        CONTENT_W,
        PAGE_H - 46 * mm,
        id="body",
        showBoundary=0,
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(story)
    print(output)


if __name__ == "__main__":
    build()
