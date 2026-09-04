const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8085';
export type Detail = { nroItem?: number; codMaterial?: string; cUnidad: string; cantid: number; ncantidadRecibida?: number; observ?: string };
export type Requisition = { codSociedad: string; nroDoc?: string; fecDoc: string; fecReq: string; ccodCencos: string; ccodPerson?: string; lugarEntr?: string; ccodProveedor?: string; tipPrio?: string; observ?: string; estado?: string; notaEntrada?: string; condic?: string; detalles: Detail[] };
export type Society = { codSociedad: string; nomSociedad?: string };
export type Catalog = { value: string; label: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('evo_token');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  if (!response.ok) { const message = await response.text(); throw new Error(message || `Error ${response.status}`); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const api = {
  login: (username: string, password: string) => request<{ token: string; username: string; sociedades: string[]; sociedadActual: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string) => request<{ message: string; username: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) }),
  selectSociety: (codSociedad: string) => request<{ token: string; username: string; sociedades: string[]; sociedadActual: string }>('/api/auth/sociedad', { method: 'POST', body: JSON.stringify({ codSociedad }) }),
  list: (sociedad: string, page = 0, size = 10, query = '', filters: { cencos?: string; estado?: string } = {}) => request<{ content: Requisition[]; totalElements: number; totalPages: number }>(`/api/requisiciones?codSociedad=${encodeURIComponent(sociedad)}&page=${page}&size=${size}${query ? `&q=${encodeURIComponent(query)}` : ''}${filters.cencos ? `&cencos=${encodeURIComponent(filters.cencos)}` : ''}${filters.estado ? `&estado=${encodeURIComponent(filters.estado)}` : ''}`),
  nextDocument: (sociedad: string) => request<string>(`/api/requisiciones/siguiente/${encodeURIComponent(sociedad)}`),
  get: (sociedad: string, nroDoc: string) => request<Requisition>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}`),
  create: (data: Requisition) => request<Requisition>('/api/requisiciones', { method: 'POST', body: JSON.stringify(data) }),
  update: (sociedad: string, nroDoc: string, data: Requisition) => request<Requisition>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel: (sociedad: string, nroDoc: string) => request<void>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}/anular`, { method: 'PATCH' }),
  remove: (sociedad: string, nroDoc: string) => request<void>(`/api/requisiciones/${encodeURIComponent(sociedad)}/${encodeURIComponent(nroDoc)}`, { method: 'DELETE' }),
  centers: (sociedad: string) => request<{ ccodCencos: string; nomCencos: string }[]>(`/api/requisiciones/listas/centros/${encodeURIComponent(sociedad)}`),
  priorities: (sociedad: string) => request<{ cvalor?: string; cnomValor?: string }[]>(`/api/requisiciones/listas/prioridades/${encodeURIComponent(sociedad)}`),
  people: (sociedad: string) => request<Record<string, string>[]>(`/api/listas/personal/${encodeURIComponent(sociedad)}`),
  suppliers: () => request<Record<string, string>[]>('/api/listas/proveedores'),
  materials: (query: string) => request<Record<string, string>[]>(`/api/listas/materiales?q=${encodeURIComponent(query)}`),
};
