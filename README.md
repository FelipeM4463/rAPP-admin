# rAPP São Carlos — painel administrativo

Painel web para cadastrar e gerenciar as repúblicas que o aplicativo mobile lê no mesmo PostgreSQL.

- Frontend: React
- Backend: NestJS
- Banco: PostgreSQL + PostGIS, no modelo do UML (`republica`, `localizacao`, `foto`, `tag`, `republica_tag`, `sessao_usuario`, `ponto_referencia`)

## Subir nesta máquina

```bash
bash scripts/dev.sh
```

O painel abre em http://127.0.0.1:5173 e a API em http://127.0.0.1:3001/api.

O script sobe o cluster local em `127.0.0.1:5433` (usuário e senha `rapp`, banco `rapp`) e o MinIO em `http://127.0.0.1:9000` (console em `http://127.0.0.1:9001`, usuário `rapp`, senha `rapp-secret`). As fotos ficam no bucket `rapp-fotos` e `foto.url_imagem` guarda a URL pública do objeto. Nesta máquina o servidor é PostgreSQL 14 com PostGIS 3.2, porque não há Docker nem pacote do PostgreSQL 16 instalado. O schema usa os mesmos recursos pedidos na modelagem: `geometry(Point, 4326)`, índice GIST e `ST_Distance`.

Com Docker disponível, `docker compose up -d` sobe a imagem `postgis/postgis:16-3.4` pedida no diagrama de componentes e o mesmo MinIO. Aponte o `DATABASE_URL` para ela e rode `npm run seed --prefix backend`.

## Acessos de desenvolvimento

| Quem | E-mail | Senha |
| --- | --- | --- |
| Equipe gestora | `gestor@rapp.com` | `rapp-gestor` |
| República dos Ipês | `ipes@republicas.rapp` | `rep123456` |
| República das Magnólias | `magnolias@republicas.rapp` | `rep123456` |
| República Barão | `barao@republicas.rapp` | `rep123456` |
| República Laranjeiras | `laranjeiras@republicas.rapp` | `rep123456` |

A equipe gestora cria, edita e exclui qualquer república. O login de uma república edita só a própria casa — a mesma conta que o app usa, gravada em `republica` e `sessao_usuario`.
