import { FormEvent, useEffect, useState } from 'react';
import { api, Requisition } from './services/api';
import { Pencil, Ban, X, LogOut } from 'lucide-react';
import agoraLogo from './assets/logo-agora.svg';
import indigitalLogo from './assets/logo-indigital.svg';
import ohLogo from './assets/logo-oh.svg';
import RequisitionDashboard from './pages/RequisitionDashboard';

type Session = { token: string; username: string; sociedades: string[]; sociedadActual: string };
const dateLabel = (value?: string) => value ? (value.includes('/') ? value.split(' ')[0] : new Date(value).toLocaleDateString('es-PE')) : '—';
const societyLogos: Record<string, string> = { '100': agoraLogo, A13: indigitalLogo, '1100': ohLogo };

function SignIn({ done }: { done: (s: Session) => void }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [expired] = useState(() => { const v = sessionStorage.getItem('evo_expired') === '1'; if (v) sessionStorage.removeItem('evo_expired'); return v; });
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { const s = await api.login(username, password); localStorage.setItem('evo_token', s.token); done({ ...s, sociedadActual: '' }); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.'); } finally { setBusy(false); } }
  return <main className="auth-page"><section className="auth-visual"><div className="brand-mark">e<span>•</span></div><p className="eyebrow">EVOLUTION ERP</p><h1>Compras que<br /><em>evolucionan.</em></h1><p className="visual-copy">Controla tus requisiciones con claridad, trazabilidad y velocidad.</p></section><section className="auth-card"><p className="eyebrow">Bienvenido de nuevo</p><h2>Ingresa a tu cuenta</h2><p className="muted">Accede al módulo de requisiciones. Usa tu usuario y contraseña del ERP.</p>{expired && <p className="alert error">Tu sesión expiró. Ingresa nuevamente.</p>}<form className="form-stack" onSubmit={submit}><label>Usuario<input required minLength={3} maxLength={30} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="Tu usuario" /></label><label>Contraseña<input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Mínimo 8 caracteres" /></label>{error && <p className="alert error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Procesando…' : 'Ingresar al sistema'} →</button></form></section></main>;
}

function Society({ session, done, cancel }: { session: Session; done: (s: Session) => void; cancel: () => void }) {
  const [selected, setSelected] = useState(session.sociedades[0] || ''); const [error, setError] = useState('');
  async function select() { try { const s = await api.selectSociety(selected); localStorage.setItem('evo_token', s.token); done(s); } catch { setError('No se pudo seleccionar la sociedad.'); } }
  return <main className="picker-page"><div className="picker-card"><div className="brand-mark small">e<span>•</span></div><p className="eyebrow">Configuración de sesión</p><h1>Selecciona una sociedad</h1><p className="muted">Hola, <strong>{session.username}</strong>. Elige el contexto de trabajo.</p><div className="society-list">{session.sociedades.map(s => <button className={`society-option ${s === selected ? 'selected' : ''}`} onClick={() => setSelected(s)} key={s}><span className="society-logo"><img src={societyLogos[s]} alt={`Logo sociedad ${s}`} /></span><span><strong>{s}</strong><small>Sociedad disponible</small></span><i>{s === selected ? '✓' : ''}</i></button>)}</div>{error && <p className="alert error">{error}</p>}<div className="session-actions"><button className="secondary-button logout-session" onClick={cancel}><LogOut size={15} /> Cancelar y cerrar sesión</button><button className="primary-button" disabled={!selected} onClick={select}>Continuar →</button></div></div></main>;
}

export function DetailModal({ item, sociedad, onClose, onEdit, onCancel }: { item: Requisition; sociedad: string; onClose: () => void; onEdit: () => void; onCancel: () => void }) {
  const cancelled = item.estado === 'ANULADO';
  const [names, setNames] = useState({ centers: {} as Record<string, string>, people: {} as Record<string, string>, priorities: {} as Record<string, string>, suppliers: {} as Record<string, string>, materials: {} as Record<string, string> });
  useEffect(() => {
    api.centers(sociedad).then(v => setNames(n => ({ ...n, centers: Object.fromEntries(v.map(x => [x.ccodCencos, x.nomCencos])) }))).catch(() => []);
    api.people(sociedad).then(v => setNames(n => ({ ...n, people: Object.fromEntries(v.map(x => [x.ccodPerson, x.nomPerson])) }))).catch(() => []);
    api.priorities(sociedad).then(v => setNames(n => ({ ...n, priorities: Object.fromEntries(v.map(x => [x.cvalor, x.cnomValor])) }))).catch(() => []);
    api.suppliers().then(v => setNames(n => ({ ...n, suppliers: Object.fromEntries(v.map(x => [x.ccodProveedor, x.nomProv])) }))).catch(() => []);
    const codes = [...new Set((item.detalles || []).map(d => d.codMaterial).filter(Boolean))] as string[];
    Promise.all(codes.map(async code => {
      try {
        const found = await api.materials(code);
        const match = found.find(m => m.codMaterial === code);
        return [code, match?.nomMaterial || code] as const;
      } catch { return [code, code] as const; }
    })).then(entries => setNames(n => ({ ...n, materials: { ...n.materials, ...Object.fromEntries(entries) } })));
  }, [sociedad, item]);
  const centerName = names.centers[item.ccodCencos] || item.ccodCencos;
  const personName = item.ccodPerson ? names.people[item.ccodPerson] || item.ccodPerson : '—';
  const prioName = item.tipPrio ? names.priorities[item.tipPrio] || item.tipPrio : 'NORMAL';
  const supplierName = item.ccodProveedor ? names.suppliers[item.ccodProveedor] || item.ccodProveedor : '—';
  const field = (label: string, value: React.ReactNode) => <div><small>{label}</small><strong>{value}</strong></div>;
  return (
    <div className="modal-backdrop">
      <section className="modal detail-modal">
        <header className="modal-head">
          <div>
            <p className="eyebrow">Detalle de requisición</p>
            <h2>{item.nroDoc}</h2>
          </div>
          <button className="close-button" onClick={onClose} title="Cerrar"><X size={19} /></button>
        </header>
        <div className="detail-status">
          <span className={`blue-status ${cancelled ? 'cancelled' : ''}`}>{cancelled ? 'Anulado' : item.estado || 'Pendiente'}</span>
          <small>Sociedad {item.codSociedad}</small>
        </div>
        <div className="detail-grid">
          {field('Nro Doc', item.nroDoc || '—')}
          {field('Fecha documento', dateLabel(item.fecDoc))}
          {field('Fecha requerida', dateLabel(item.fecReq))}
          {field('Centro de costo', `${item.ccodCencos} - ${centerName}`)}
          {field('Personal', personName)}
          {field('Prioridad', prioName)}
          {field('Proveedor sugerido', item.ccodProveedor ? `${item.ccodProveedor} - ${supplierName}` : '—')}
          {field('Lugar de entrega', item.lugarEntr || '—')}
          {field('Observaciones', item.observ || '—')}
        </div>
        <div className="detail-items">
          <h3>Artículos ({item.detalles?.length || 0})</h3>
          <table className="detail-table">
            <thead><tr><th>#</th><th>Código</th><th>Material</th><th>Unidad</th><th>Cantidad</th><th>Recibido</th><th>Proveedor</th></tr></thead>
            <tbody>
              {(item.detalles || []).flatMap((d, i) => {
                const rows = [(
                  <tr key={`${i}`}>
                    <td>{i + 1}</td>
                    <td>{d.codMaterial || '*'}</td>
                    <td>
                      <strong>{d.codMaterial ? names.materials[d.codMaterial] || d.codMaterial : d.observ || '*'}</strong>
                    </td>
                    <td>{d.cUnidad}</td>
                    <td className="num">{Number(d.cantid).toFixed(2)}</td>
                    <td className="num">{Number(d.ncantidadRecibida || 0).toFixed(2)}</td>
                    <td>{d.ccodProveedor ? names.suppliers[d.ccodProveedor] || d.ccodProveedor : '—'}</td>
                  </tr>
                )];
                if (d.codMaterial) {
                  (d.observ || '').split('\n').map(l => l.trim()).filter(l => l !== '').forEach((text, n) => {
                    rows.push((
                      <tr key={`${i}-${n}`} className="note-row">
                        <td />
                        <td />
                        <td className="note-text">• {text}</td>
                        <td />
                        <td className="num">,00</td>
                        <td className="num">0.00</td>
                        <td />
                      </tr>
                    ));
                  });
                }
                return rows;
              })}
            </tbody>
          </table>
        </div>
        <footer className="modal-actions">
          <button className="secondary-button" onClick={onClose}><X size={15} /> Cerrar</button>
          <button className="secondary-button" disabled={cancelled} onClick={onCancel}><Ban size={15} /> Anular</button>
          <button className="primary-button" disabled={cancelled} onClick={onEdit}><Pencil size={15} /> Editar</button>
        </footer>
      </section>
    </div>
  );
}

export default function AppComplete() { const [session, setSession] = useState<Session | null>(() => { const raw = localStorage.getItem('evo_session'); return raw ? JSON.parse(raw) : null; }); const [logged, setLogged] = useState(() => Boolean(localStorage.getItem('evo_token'))); function done(s: Session) { setSession(s); setLogged(true); localStorage.setItem('evo_session', JSON.stringify(s)); } function logout() { localStorage.clear(); setSession(null); setLogged(false); } if (!logged || !session) return <SignIn done={done} />; if (!session.sociedadActual) return <Society session={session} done={done} cancel={logout} />; return <RequisitionDashboard session={session} logout={logout} />; }
