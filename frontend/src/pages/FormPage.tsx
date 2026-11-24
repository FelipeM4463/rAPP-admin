import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { MapView } from '../components/MapView';
import type { PontoReferencia, Republica, Tag } from '../types';

const SAO_CARLOS = { lat: -22.0175, lng: -47.8908 };
const groups = [
  { categoria: 'genero', titulo: 'Perfil da casa', ajuda: 'Escolha Mista, Feminina ou Masculina. O catálogo do app depende dessa tag.' },
  { categoria: 'refeicao', titulo: 'Refeições', ajuda: '' },
  { categoria: 'universidade', titulo: 'Universidade', ajuda: '' },
  { categoria: 'convivencia', titulo: 'Convivência', ajuda: '' },
];

export function FormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { session } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [pontos, setPontos] = useState<PontoReferencia[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [instagram, setInstagram] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [latitude, setLatitude] = useState(SAO_CARLOS.lat);
  const [longitude, setLongitude] = useState(SAO_CARLOS.lng);
  const [confirmada, setConfirmada] = useState(false);
  const [flyKey, setFlyKey] = useState(0);
  const [rotulo, setRotulo] = useState('');
  const [fotos, setFotos] = useState<Republica['fotos']>([]);
  const [locais, setLocais] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  const blocked =
    (isNew && session?.role !== 'gestor') ||
    (!isNew && session?.role === 'republica' && session.republicaId !== id);

  useEffect(() => {
    api<Tag[]>('/api/tags').then(setTags).catch((err: Error) => setError(err.message));
    api<PontoReferencia[]>('/api/pontos-referencia').then(setPontos).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) return;
    api<Republica>(`/api/republicas/${id}`)
      .then((data) => {
        setNome(data.nome);
        setEmail(data.email ?? '');
        setInstagram(data.instagram);
        setWhatsapp(data.whatsapp);
        setDescricao(data.descricao);
        setPreco(String(data.precoMensal));
        setTagIds(data.tags.map((tag) => tag.id));
        setFotos(data.fotos);
        if (data.localizacao) {
          setLogradouro(data.localizacao.logradouro);
          setNumero(data.localizacao.numero);
          setBairro(data.localizacao.bairro);
          setCep(data.localizacao.cep ?? '');
          setLatitude(data.localizacao.latitude);
          setLongitude(data.localizacao.longitude);
          setConfirmada(true);
          setFlyKey(1);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const previews = useMemo(() => locais.map((file) => ({ file, url: URL.createObjectURL(file) })), [locais]);
  useEffect(() => {
    return () => previews.forEach((item) => URL.revokeObjectURL(item.url));
  }, [previews]);

  if (blocked) return <Navigate to="/" replace />;
  if (loading) return <p className="muted">Carregando cadastro...</p>;

  function toggleTag(tag: Tag) {
    setTagIds((current) => {
      if (tag.categoria === 'genero') {
        const others = current.filter((item) => tags.find((candidate) => candidate.id === item)?.categoria !== 'genero');
        return [...others, tag.id];
      }
      return current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id];
    });
  }

  async function localizar() {
    setError('');
    try {
      let rua = logradouro;
      let bairroAtual = bairro;
      const digits = cep.replace(/\D/g, '');
      if (digits.length === 8) {
        const endereco = await api<{ logradouro: string; bairro: string; cidade: string }>(`/api/geo/cep/${digits}`);
        if (endereco.cidade && endereco.cidade.toLowerCase() !== 'são carlos') {
          throw new Error('O rAPP cadastra apenas repúblicas em São Carlos.');
        }
        if (endereco.logradouro) {
          rua = endereco.logradouro;
          setLogradouro(endereco.logradouro);
        }
        if (endereco.bairro) {
          bairroAtual = endereco.bairro;
          setBairro(endereco.bairro);
        }
      }
      const tentativas = [
        [rua, numero, bairroAtual, 'São Carlos', 'SP'].filter(Boolean).join(', '),
        [rua, 'São Carlos', 'SP'].filter(Boolean).join(', '),
        [bairroAtual, 'São Carlos', 'SP'].filter(Boolean).join(', '),
      ];
      let geo: { latitude: number; longitude: number; rotulo: string } | null = null;
      let ultimoErro = 'Não encontramos esse endereço. Ajuste o pino no mapa.';
      for (const consulta of tentativas) {
        if (consulta.length < 5) continue;
        try {
          geo = await api<{ latitude: number; longitude: number; rotulo: string }>(
            `/api/geo/geocode?q=${encodeURIComponent(consulta)}`,
          );
          break;
        } catch (err) {
          ultimoErro = err instanceof Error ? err.message : ultimoErro;
        }
      }
      if (!geo) throw new Error(ultimoErro);
      setLatitude(geo.latitude);
      setLongitude(geo.longitude);
      setRotulo(geo.rotulo);
      setConfirmada(true);
      setFlyKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível localizar o endereço.');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const precoMensal = Number(preco.replace(',', '.'));
    const genero = tagIds.some((tagId) => tags.find((tag) => tag.id === tagId)?.categoria === 'genero');
    if (!genero) {
      setError('Selecione ao menos uma tag de gênero: Mista, Feminina ou Masculina.');
      return;
    }
    if (!confirmada) {
      setError('Localize o endereço no mapa e confirme o pino antes de salvar.');
      return;
    }
    if (Number.isNaN(precoMensal)) {
      setError('Informe o preço mensal.');
      return;
    }

    const payload = {
      nome,
      email,
      instagram: instagram.replace(/^@+/, ''),
      whatsapp: whatsapp.replace(/\D/g, ''),
      descricao,
      precoMensal,
      tagIds,
      localizacao: {
        logradouro,
        numero,
        bairro,
        cep: cep.replace(/\D/g, '') || undefined,
        latitude,
        longitude,
      },
      ...(isNew || senha ? { senha } : {}),
    };

    setBusy(true);
    try {
      const saved = await api<Republica>(isNew ? '/api/republicas' : `/api/republicas/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify(payload),
      });
      if (isNew && locais.length) {
        const form = new FormData();
        locais.forEach((file) => form.append('fotos', file));
        try {
          await api(`/api/republicas/${saved.id}/fotos`, { method: 'POST', body: form });
        } catch (err) {
          navigate(`/republicas/${saved.id}/editar`, {
            state: { error: err instanceof Error ? err.message : 'A república foi criada, mas as fotos não subiram.' },
          });
          return;
        }
      }
      navigate(`/republicas/${saved.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadNovas(list: FileList | null) {
    if (!list?.length) return;
    if (!id) {
      setLocais((current) => [...current, ...Array.from(list)].slice(0, 10));
      return;
    }
    const form = new FormData();
    Array.from(list).forEach((file) => form.append('fotos', file));
    setBusy(true);
    try {
      const updated = await api<Republica>(`/api/republicas/${id}/fotos`, { method: 'POST', body: form });
      setFotos(updated.fotos);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar as fotos.');
    } finally {
      setBusy(false);
    }
  }

  async function removerFoto(fotoId: string) {
    if (!id) return;
    const updated = await api<Republica>(`/api/republicas/${id}/fotos/${fotoId}`, { method: 'DELETE' });
    setFotos(updated.fotos);
  }

  async function tornarCapa(fotoId: string) {
    if (!id) return;
    const updated = await api<Republica>(`/api/republicas/${id}/fotos/${fotoId}/principal`, { method: 'PATCH' });
    setFotos(updated.fotos);
  }

  async function mover(index: number, delta: number) {
    if (!id) return;
    const next = [...fotos];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    const updated = await api<Republica>(`/api/republicas/${id}/fotos/ordem`, {
      method: 'PUT',
      body: JSON.stringify({ ids: next.map((foto) => foto.id) }),
    });
    setFotos(updated.fotos);
  }

  const totalFotos = fotos.length + (isNew ? locais.length : 0);

  return (
    <form className="editor" onSubmit={onSubmit}>
      <div className="detail-top">
        <div>
          <p className="eyebrow">{isNew ? 'Novo cadastro' : 'Editar república'}</p>
          <h1>{isNew ? 'Cadastrar república' : nome || 'República'}</h1>
        </div>
        <Link className="btn ghost" to={id ? `/republicas/${id}` : '/'}>
          Voltar
        </Link>
      </div>

      <div className="editor-grid">
        <div className="stack">
          <section className="panel">
            <h2>Dados da casa</h2>
            <label className="field">
              <span>Nome da república</span>
              <input value={nome} onChange={(event) => setNome(event.target.value)} required maxLength={160} />
            </label>
            <div className="split">
              <label className="field">
                <span>E-mail de acesso</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="field">
                <span>{isNew ? 'Senha do aplicativo' : 'Nova senha'}</span>
                <input
                  type="password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  placeholder={isNew ? 'Mínimo de 6 caracteres' : 'Em branco mantém a senha atual'}
                  required={isNew}
                  minLength={isNew ? 6 : undefined}
                />
              </label>
            </div>
            <div className="split">
              <label className="field">
                <span>Instagram</span>
                <div className="prefix">
                  <em>@</em>
                  <input
                    value={instagram}
                    onChange={(event) => setInstagram(event.target.value.replace(/^@+/, ''))}
                    required
                  />
                </div>
              </label>
              <label className="field">
                <span>WhatsApp</span>
                <input
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="16999999999"
                  required
                />
              </label>
            </div>
            <label className="field">
              <span>Descrição</span>
              <textarea
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                placeholder="Adicione uma descrição da sua rep!"
                rows={5}
                required
                minLength={10}
              />
            </label>
            <label className="field short">
              <span>Preço mensal</span>
              <div className="prefix">
                <em>R$</em>
                <input
                  inputMode="decimal"
                  value={preco}
                  onChange={(event) => setPreco(event.target.value)}
                  placeholder="820"
                  required
                />
              </div>
            </label>
          </section>

          <section className="panel">
            <h2>Tags</h2>
            {groups.map((group) => (
              <div key={group.categoria} className="tag-group">
                <div>
                  <h3>{group.titulo}</h3>
                  {group.ajuda && <p className="hint">{group.ajuda}</p>}
                </div>
                <div className="filters">
                  {tags
                    .filter((tag) => tag.categoria === group.categoria)
                    .map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className={`pill ${tagIds.includes(tag.id) ? 'active' : ''}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag.nome}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <h2>Localização</h2>
            <p className="hint">Informe o CEP ou o endereço. O pino precisa ficar em São Carlos antes de salvar.</p>
            <div className="split">
              <label className="field">
                <span>CEP</span>
                <input value={cep} onChange={(event) => setCep(event.target.value)} placeholder="00000-000" />
              </label>
              <label className="field">
                <span>Número</span>
                <input value={numero} onChange={(event) => setNumero(event.target.value)} required />
              </label>
            </div>
            <label className="field">
              <span>Logradouro</span>
              <input value={logradouro} onChange={(event) => setLogradouro(event.target.value)} required />
            </label>
            <label className="field">
              <span>Bairro</span>
              <input value={bairro} onChange={(event) => setBairro(event.target.value)} required />
            </label>
            <button className="btn ghost" type="button" onClick={localizar}>
              Localizar no mapa
            </button>
            <MapView
              lat={latitude}
              lng={longitude}
              flyKey={flyKey}
              draggable
              pontos={pontos}
              onDrag={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
                setConfirmada(true);
                setRotulo('Pino ajustado manualmente.');
              }}
            />
            <p className="hint">
              {confirmada
                ? `${rotulo || 'Localização confirmada.'} ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                : 'Arraste o pino ou localize o endereço para confirmar.'}
            </p>
          </section>

          <section className="panel">
            <h2>Fotos da casa</h2>
            <p className="hint">Até 10 fotos. O envio reduz a imagem para no máximo 1920×1080 em WebP.</p>
            <p className="meta">
              <span>Enviadas</span>
              {totalFotos}/10
            </p>
            {fotos.length > 0 && (
              <div className="photo-grid">
                {fotos.map((foto, index) => (
                  <figure key={foto.id}>
                    <img src={foto.urlImagem} alt="" />
                    {foto.ePrincipal && <em>Capa</em>}
                    <div>
                      <button type="button" onClick={() => mover(index, -1)} disabled={index === 0}>
                        ←
                      </button>
                      <button type="button" onClick={() => mover(index, 1)} disabled={index === fotos.length - 1}>
                        →
                      </button>
                      {!foto.ePrincipal && (
                        <button type="button" onClick={() => tornarCapa(foto.id)}>
                          Capa
                        </button>
                      )}
                      <button type="button" onClick={() => removerFoto(foto.id)}>
                        Excluir
                      </button>
                    </div>
                  </figure>
                ))}
              </div>
            )}
            {isNew && previews.length > 0 && (
              <div className="photo-grid">
                {previews.map((item) => (
                  <figure key={item.url}>
                    <img src={item.url} alt="" />
                    <div>
                      <button type="button" onClick={() => setLocais((current) => current.filter((file) => file !== item.file))}>
                        Remover
                      </button>
                    </div>
                  </figure>
                ))}
              </div>
            )}
            {totalFotos < 10 && (
              <label className="upload">
                Adicionar fotos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(event) => {
                    uploadNovas(event.target.files);
                    event.target.value = '';
                  }}
                />
              </label>
            )}
          </section>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="savebar">
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Salvando...' : isNew ? 'Cadastrar república' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
