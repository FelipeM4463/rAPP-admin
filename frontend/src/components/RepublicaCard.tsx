import { Link } from 'react-router-dom';
import { capaOf, featureTags, formatPreco, genderOf } from '../format';
import type { Republica } from '../types';

const emoji: Record<string, string> = {
  Mista: '👥',
  Masculina: '👨',
  Feminina: '👩',
};

type CardProps = {
  republica: Republica;
  canEdit: boolean;
  canDelete: boolean;
  onDelete: () => void;
};

export function RepublicaCard({ republica, canEdit, canDelete, onDelete }: CardProps) {
  const capa = capaOf(republica.fotos);
  const genero = genderOf(republica.tags);
  const tags = featureTags(republica.tags).slice(0, 3);

  return (
    <article className="card">
      <Link to={`/republicas/${republica.id}`} className="card-media">
        {capa ? (
          <img src={capa.urlImagem} alt="" />
        ) : (
          <div className="cover-fallback" aria-hidden>
            {republica.nome.slice(0, 1)}
          </div>
        )}
        {genero && (
          <span className={`badge ${genero.nome.toLowerCase()}`}>
            <span aria-hidden>{emoji[genero.nome] ?? '•'}</span>
            {genero.nome}
          </span>
        )}
      </Link>
      <div className="card-body">
        <h2>
          <Link to={`/republicas/${republica.id}`}>{republica.nome}</Link>
        </h2>
        <p className="place">
          {republica.localizacao?.bairro ?? 'São Carlos'} · São Carlos, SP
        </p>
        <div className="tags">
          {tags.map((tag) => (
            <span key={tag.id} className={`tag ${tag.categoria}`}>
              {tag.nome}
            </span>
          ))}
        </div>
        <div className="card-foot">
          <p className="price">
            {formatPreco(republica.precoMensal)}
            <span>/mês</span>
          </p>
          <div className="card-actions">
            {canEdit && (
              <Link className="btn tiny" to={`/republicas/${republica.id}/editar`}>
                Editar
              </Link>
            )}
            {canDelete && (
              <button className="btn tiny ghost" type="button" onClick={onDelete}>
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
