import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Confirm } from '../components/Confirm';
import { RepublicaCard } from '../components/RepublicaCard';
import { formatPreco } from '../format';
import type { Metricas, Republica, Tag } from '../types';

const categoryOrder = ['genero', 'refeicao', 'universidade', 'convivencia'];
const genderOrder = ['Mista', 'Masculina', 'Feminina'];
const emoji: Record<string, string> = { Mista: '👥', Masculina: '👨', Feminina: '👩' };

export function CatalogPage() {
  const { session } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [republicas, setRepublicas] = useState<Republica[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [faixa, setFaixa] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Republica | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<Tag[]>('/api/tags')
      .then(setTags)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debounced.trim()) params.set('q', debounced.trim());
    if (selected.length) params.set('tagIds', selected.join(','));
    if (faixa === '700') params.set('precoMax', '700');
    if (faixa === '1000') {
      params.set('precoMin', '700');
      params.set('precoMax', '1000');
    }
    if (faixa === '1000+') params.set('precoMin', '1000');

    setLoading(true);
    api<{ republicas: Republica[]; metricas: Metricas }>(`/api/republicas?${params.toString()}`)
      .then((data) => {
        setRepublicas(data.republicas);
        setMetricas(data.metricas);
        setError('');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [debounced, selected, faixa, reload]);

  const orderedTags = useMemo(() => {
    return [...tags].sort((a, b) => {
      const category = categoryOrder.indexOf(a.categoria) - categoryOrder.indexOf(b.categoria);
      if (category !== 0) return category;
      if (a.categoria === 'genero') return genderOrder.indexOf(a.nome) - genderOrder.indexOf(b.nome);
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [tags]);

  function toggle(tagId: number) {
    setSelected((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api(`/api/republicas/${pendingDelete.id}`, { method: 'DELETE' });
      setPendingDelete(null);
      setReload((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir.');
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const totalLabel = metricas?.total === 1 ? '1 república cadastrada' : `${metricas?.total ?? 0} repúblicas cadastradas`;

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Buscar república</span>
          <SearchIcon />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar república..."
          />
        </label>
        <div className="filters">
          <button
            type="button"
            className={`pill ${selected.length === 0 ? 'active' : ''}`}
            onClick={() => setSelected([])}
          >
            Todas
          </button>
          <label className="pill select">
            <select value={faixa} onChange={(event) => setFaixa(event.target.value)} aria-label="Faixa de preço">
              <option value="">Qualquer preço</option>
              <option value="700">Até R$ 700</option>
              <option value="1000">R$ 700 a R$ 1.000</option>
              <option value="1000+">Acima de R$ 1.000</option>
            </select>
          </label>
          {orderedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={`pill ${selected.includes(tag.id) ? 'active' : ''}`}
              onClick={() => toggle(tag.id)}
            >
              {emoji[tag.nome] && <span aria-hidden>{emoji[tag.nome]}</span>}
              {tag.nome}
            </button>
          ))}
        </div>
      </div>

      <section className="hero">
        <div>
          <p className="eyebrow">Catálogo de repúblicas</p>
          <h1>
            Gerencie as <em>repúblicas</em>
            <br />
            de São Carlos
          </h1>
          <p className="lede">{totalLabel} · São Carlos</p>
        </div>
        {session?.role === 'gestor' && (
          <Link className="btn primary" to="/republicas/nova">
            Nova república
          </Link>
        )}
      </section>

      {metricas && (
        <section className="metrics">
          <article>
            <strong>{metricas.total}</strong>
            <span>cadastradas</span>
          </article>
          <article>
            <strong>{formatPreco(metricas.precoMedio)}</strong>
            <span>preço médio</span>
          </article>
          <article>
            <strong>{metricas.comFotos}</strong>
            <span>com fotos</span>
          </article>
          <article>
            <strong>{metricas.semLocalizacao}</strong>
            <span>sem localização</span>
          </article>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <div className="grid">
          <div className="card skeleton" />
          <div className="card skeleton" />
          <div className="card skeleton" />
        </div>
      ) : republicas.length === 0 ? (
        <div className="empty">
          <h2>Nenhuma república encontrada</h2>
          <p>Ajuste a busca ou limpe os filtros para ver o catálogo de São Carlos.</p>
        </div>
      ) : (
        <div className="grid">
          {republicas.map((republica) => {
            const own = session?.role === 'republica' && session.republicaId === republica.id;
            return (
              <RepublicaCard
                key={republica.id}
                republica={republica}
                canEdit={session?.role === 'gestor' || own}
                canDelete={session?.role === 'gestor'}
                onDelete={() => setPendingDelete(republica)}
              />
            );
          })}
        </div>
      )}

      {pendingDelete && (
        <Confirm
          title={`Excluir ${pendingDelete.nome}?`}
          body="A casa sai do catálogo compartilhado com o aplicativo, junto com fotos, localização e sessões."
          confirmLabel="Excluir república"
          busy={deleting}
          onConfirm={confirmDelete}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width="18" height="18">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16.5 20 20.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
