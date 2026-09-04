const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8085';

// Tipos espejo de los DTOs del backend (com.evolutionerp.dtos)
export type Detail = {
  nroItem?: number;
  codMaterial?: string;
  cUnidad: string;
  cantid: number;
  ncantidadRecibida?: number;
  observ?: string;
  ccodProveedor?: string;
  estado?: string;
};
export type Requisition = {
  codSociedad: string;
  nroDoc?: string;
  fecDoc: string;
  fecReq: string;
  ccodCencos: string;
  ccodPerson?: string;
  lugarEntr?: string;
  ccodProveedor?: string;
  tipPrio?: string;
  observ?: string;
  estado?: string;
  notaEntrada?: string;
  condic?: string;
  detalles: Detail[];
};
export type Society = { codSociedad: string; nomSociedad?: string };
export type CostCenter = { codSociedad: string; ccodCencos: string; nomCencos: string };
export type Priority = { codSociedad: string; cvalor: string; cnomValor: string; app: string };
export type Person = { ccodPerson: string; codSociedad?: string; nomPerson: string };
export type Supplier = { ccodProveedor: string; nomProv: string; ruc?: string };
export type Material = { codMaterial: string; nomMaterial: string; cUnidad: string };
export type ListFilters = { cencos?: string; estado?: string; prio?: string; fecIni?: string; fecFin?: string };

// Extrae un mensaje legible de las respuestas de error del backend:
// CustomErrorRecord JSON {message, details}, JSON de Spring {message},
// o texto plano. Nunca se muestra JSON crudo al usuario.
export function friendlyError(message: string, fallback: string): string {
  if (!message) return fallback;
  try {
    const parsed = JSON.parse(message);
    if (typeof parsed === "string") return parsed;
    if (parsed?.message) return String(parsed.message);
    if (parsed?.details) return String(parsed.details);
    if (parsed?.error) return String(parsed.error);
  } catch {
    // no es JSON: usar el texto tal cual (acotado)
  }
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('evo_token');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  if (response.status === 401 || response.status === 403) {
    const raw = await response.text();
    // Sesión expirada o sin sociedad: limpiar y volver al login con aviso.
    if (response.status === 401 && localStorage.getItem('evo_token')) {
      localStorage.removeItem('evo_token');
      localStorage.removeItem('evo_session');
      sessionStorage.setItem('evo_expired', '1');
      location.reload();
      throw new Error('Sesión expirada. Ingresa nuevamente.');
    }
    throw new Error(friendlyError(raw, response.status === 401 ? 'Usuario o contraseña incorrectos.' : 'No tienes permiso para esta operación.'));
  }
  if (!response.ok) { const message = await response.text(); throw new Error(friendlyError(message, `Error ${response.status}`)); }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// El backend responde 404 con texto cuando una lista está vacía ("No hay...").
// Para los catálogos eso significa lista vacía, no error.
async function requestList<T>(path: string): Promise<T[]> {
  try {
    const data = await request<T[] | T>(path);
    if (Array.isArray(data)) return data;
    return [];
  } catch (err) {
    if (err instanceof Error && /No hay|404/.test(err.message)) return [];
    throw err;
  }
}

export const api = {
  login: (username: string, password: string) => request<{ token: string; username: string; sociedades: string[]; sociedadActual: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  selectSociety: (codSociedad: string) => request<{ token: string; username: string; sociedades: string[]; sociedadActual: string }>('/api/auth/sociedad', { method: 'POST', body: JSON.stringify({ codSociedad }) }),
  list: (sociedad: string, page = 0, size = 10, query = '', filters: ListFilters = {}) => {
    const params = new URLSearchParams({ codSociedad: sociedad, page: String(page), size: String(size) });
    if (query) params.set('q', query);
    if (filters.cencos) params.set('cencos', filters.cencos);
    if (filters.estado) params.set('estado', filters.estado);
    if (filters.prio) params.set('prio', filters.prio);
    if (filters.fecIni) params.set('fecIni', filters.fecIni);
    if (filters.fecFin) params.set('fecFin', filters.fecFin);
    return request<{ content: Requisition[]; totalElements: number; totalPages: number }>(`/api/requisiciones?${params.toString()}`);
  },
  get: (sociedad: string, nroDoc: string) => request<Requisition>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}`),
  // El correlativo lo genera el backend (evo.next_correlativo + EnumRangos app=COM):
  // crear sin nroDoc. Si se informa, el backend lo respeta.
  create: (data: Requisition) => request<Requisition>('/api/requisiciones', { method: 'POST', body: JSON.stringify(data) }),
  update: (sociedad: string, nroDoc: string, data: Requisition) => request<Requisition>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (sociedad: string, nroDoc: string) => request<void>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}/anular`, { method: 'PATCH' }),
  remove: (sociedad: string, nroDoc: string) => request<void>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}`, { method: 'DELETE' }),
  centers: (sociedad: string) => requestList<CostCenter>(`/api/centros-costo?codSociedad=${encodeURIComponent(sociedad)}`),
  priorities: (sociedad: string) => requestList<Priority>(`/api/constantes?codSociedad=${encodeURIComponent(sociedad)}&app=PRIO`),
  people: (sociedad: string) => requestList<Person>(`/api/personal?codSociedad=${encodeURIComponent(sociedad)}`),
  suppliers: (query = '') => requestList<Supplier>(query ? `/api/proveedores?q=${encodeURIComponent(query)}` : '/api/proveedores'),
  materials: (query: string) => requestList<Material>(`/api/materiales?q=${encodeURIComponent(query)}`),
};
