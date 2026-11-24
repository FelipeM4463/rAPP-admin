import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('/')} type="button">
          <strong>Rapp.</strong>
          <span>gerencie as repúblicas</span>
        </button>
        <div className="who">
          <div>
            <small>{session?.role === 'gestor' ? 'Equipe gestora' : 'República'}</small>
            <strong>{session?.nome}</strong>
          </div>
          <button
            className="btn ghost"
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            Sair
          </button>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
