import { LogOut } from "lucide-react";

export type AppSidebarSession = {
  username: string;
  sociedadActual: string;
};

export type AppSidebarView = "historial" | "requisiciones";

type AppSidebarProps = {
  session: AppSidebarSession;
  active: AppSidebarView;
  total?: number;
  onGoHistorial: () => void;
  onGoRequisiciones: () => void;
  onLogout: () => void;
};

/**
 * Barra lateral única del módulo de requisiciones.
 * Se usa igual en Historial y en Registrar requisición para que
 * ambas vistas se vean y se comporten igual.
 */
export default function AppSidebar({
  session,
  active,
  total,
  onGoHistorial,
  onGoRequisiciones,
  onLogout,
}: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="blue-brand">
        <span>•</span>
        <strong>
          Evolution<span>ERP</span>
        </strong>
      </div>
      <nav>
        <a
          className={active === "historial" ? "active" : ""}
          onClick={onGoHistorial}
        >
          Historial
        </a>
        <a
          className={active === "requisiciones" ? "active" : ""}
          onClick={onGoRequisiciones}
        >
          Requisiciones {total != null && <b>{total}</b>}
        </a>
      </nav>
      <div className="blue-user">
        <div className="avatar">{session.username[0]}</div>
        <div>
          <strong>{session.username}</strong>
          <small>{session.sociedadActual}</small>
        </div>
        <button onClick={onLogout} title="Cerrar sesión">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
