import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Confirm } from '../components/Confirm';
import { MapView } from '../components/MapView';
import { featureTags, formatCep, formatPhone, formatPreco, genderOf, instagramLink, whatsappLink } from '../format';
import type { PontoReferencia, Republica } from '../types';

export function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [republica, setRepublica] = useState<Republica | null>(null);
  const [pontos, setPontos] = useState<PontoReferencia[]>([]);
  const [fotoId, setFotoId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Republica>(`/api/republicas/${id}`)
      .then((data) => {
        setRepublica(data);
        const principal = data.fotos.find((foto) => foto.ePrincipal) ?? data.fotos[0];
        setFotoId(principal?.id ?? null);
      })
      .catch((err: Error) => setError(err.message));
    api<PontoReferencia[]>('/api/pontos-referencia')
      .then(setPontos)
      .catch(() => undefined);
  }, [id]);

  if (error && !republica) return <p className="error">{error}</p>;
  if (!republica) return <p className="muted">Carregando república...</p>;

  const genero = genderOf(republica.tags);
  const tags = featureTags(republica.tags);
  const ativa = republica.fotos.find((foto) => foto.id === fotoId) ?? republica.fotos[0];
  const local = republica.localizacao;
  const own = session?.role === 'republica' && session.republicaId === republica.id;
  const canEdit = session?.role === 'gestor' || own;
  const canDelete = session?.role === 'gestor';

  async function remove() {
    setDeleting(true);
    try {
      await api(`/api/republicas/${republica!.id}`, { method: 'DELETE' });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="detail">
      <div className="detail-top">
        <div>
          <p className="eyebrow">República em São Carlos</p>
          <h1>{republica.nome}</h1>
          <p className="place">
            {local ? `${local.bairro} · São Carlos, SP` : 'Localização ainda não informada'}
          </p>
        </div>
        <div className="detail-actions">
          {canEdit && (
            <Link className="btn primary" to={`/republicas/${republica.id}/editar`}>
              Editar
            </Link>
          )}
          {canDelete && (
            <button className="btn ghost" type="button" onClick={() => setConfirming(true)}>
              Excluir
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        <section className="gallery">
          {ativa ? (
            <img src={ativa.urlImagem} alt={`Foto de ${republica.nome}`} />
          ) : (
            <div className="cover-fallback large">{republica.nome.slice(0, 1)}</div>
          )}
          {republica.fotos.length > 1 && (
            <div className="thumbs">
              {republica.fotos.map((foto) => (
                <button
                  key={foto.id}
                  type="button"
                  className={foto.id === ativa?.id ? 'active' : ''}
                  onClick={() => setFotoId(foto.id)}
                >
                  <img src={foto.urlImagem} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="detail-info">
          <p className="price big">
            {formatPreco(republica.precoMensal)}
            <span>/mês</span>
          </p>
          <div className="tags">
            {genero && <span className={`tag genero`}>{genero.nome}</span>}
            {tags.map((tag) => (
              <span key={tag.id} className={`tag ${tag.categoria}`}>
                {tag.nome}
              </span>
            ))}
          </div>
          <p className="descricao">{republica.descricao}</p>
          {republica.email && (
            <p className="meta">
              <span>E-mail de acesso</span>
              {republica.email}
            </p>
          )}
          <p className="meta">
            <span>WhatsApp</span>
            {formatPhone(republica.whatsapp)}
          </p>
          <p className="meta">
            <span>Instagram</span>@{republica.instagram}
          </p>
          {local && (
            <p className="meta">
              <span>Endereço</span>
              {local.logradouro}, {local.numero} · {local.bairro}
              {local.cep ? ` · ${formatCep(local.cep)}` : ''}
            </p>
          )}
          <div className="contact">
            <a className="btn whatsapp" href={whatsappLink(republica.whatsapp, republica.nome)} target="_blank" rel="noreferrer">
              Conversar no WhatsApp
            </a>
            <a className="btn ghost" href={instagramLink(republica.instagram)} target="_blank" rel="noreferrer">
              Abrir Instagram
            </a>
          </div>
        </section>
      </div>

      {local && (
        <section className="panel map-panel">
          <h2>Localização</h2>
          <MapView lat={local.latitude} lng={local.longitude} flyKey={0} pontos={pontos} />
          <p className="hint">Os pontos escuros marcam os campi e referências usados pelo filtro de proximidade do app.</p>
        </section>
      )}

      {error && <p className="error">{error}</p>}
      {confirming && (
        <Confirm
          title={`Excluir ${republica.nome}?`}
          body="A casa sai do catálogo compartilhado com o aplicativo, junto com fotos, localização e sessões."
          confirmLabel="Excluir república"
          busy={deleting}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
    </article>
  );
}
