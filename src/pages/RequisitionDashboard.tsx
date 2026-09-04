import { FormEvent, useEffect, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { api, Requisition } from "../services/api";
import { DetailModal } from "../AppComplete";
import RequisitionEditor from "./RequisitionEditorPage";
import AppSidebar from "../components/AppSidebar";

type Session = {
  token: string;
  username: string;
  sociedades: string[];
  sociedadActual: string;
};
const formatDate = (value?: string) => {
  if (!value) return "—";
  const raw = value.split(" ")[0];
  const date = raw.includes("/")
    ? (() => {
        const [day, month, year] = raw.split("/").map(Number);
        return new Date(year, month - 1, day);
      })()
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(date);
  const dayPart = parts.find((part) => part.type === "day")?.value || "";
  const monthPart =
    parts.find((part) => part.type === "month")?.value.replace(".", "") || "";
  const yearPart = parts.find((part) => part.type === "year")?.value || "";
  return `${dayPart} ${monthPart} ${yearPart}`;
};
const displayStatus = (item: Requisition) => item.estado || "PENDIENTE";
// Grupo estimado por palabra clave (el backend aún no tiene maestro de
// grupos; cuando exista, reemplazar por el dato real).
const groupOf = (name: string) => {
  const value = (name || "").toUpperCase();
  if (value.includes("TAMBOR")) return "Tambores";
  if (value.includes("PALLET")) return "Pallets";
  if (value.includes("ACEITE")) return "Aceites";
  if (value.includes("ABRAZADERA")) return "Abrazaderas";
  return "Materiales";
};
const qty = (cantid?: number, unidad?: string) =>
  `${Number(cantid || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unidad || ""}`.trim();

export default function RequisitionDashboard({
  session,
  logout,
}: {
  session: Session;
  logout: () => void;
}) {
  const [items, setItems] = useState<Requisition[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState("");
  const [status, setStatus] = useState("");
  const [prio, setPrio] = useState("");
  const [fecIni, setFecIni] = useState("");
  const [fecFin, setFecFin] = useState("");
  const [centers, setCenters] = useState<{ ccodCencos: string; nomCencos: string }[]>([]);
  const [priorities, setPriorities] = useState<{ cvalor: string; cnomValor: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Requisition | "new" | null>(null);
  const [selected, setSelected] = useState<Requisition | null>(null);
  const [materialNames, setMaterialNames] = useState<Record<string, string>>(
    {},
  );
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>(
    {},
  );
  const [centerNames, setCenterNames] = useState<Record<string, string>>({});
  const [personNames, setPersonNames] = useState<Record<string, string>>({});
  const [prioNames, setPrioNames] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const result = await api.list(session.sociedadActual, page, 10, query, {
        cencos: center || undefined,
        estado: status || undefined,
        prio: prio || undefined,
        fecIni: fecIni ? `${fecIni}T00:00:00` : undefined,
        fecFin: fecFin ? `${fecFin}T23:59:59` : undefined,
      });
      setItems(result.content || []);
      setPages(result.totalPages || 0);
      setTotal(result.totalElements || 0);
    } catch {
      setNotice("No se pudo conectar con el backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page, center, status, prio, fecIni, fecFin]);
  useEffect(() => {
    api.centers(session.sociedadActual).then(setCenters).catch(() => []);
    api
      .priorities(session.sociedadActual)
      .then((values) => {
        setPriorities(values);
        setPrioNames(
          Object.fromEntries(values.map((v) => [v.cvalor, v.cnomValor])),
        );
      })
      .catch(() => []);
    api
      .people(session.sociedadActual)
      .then((values) =>
        setPersonNames(
          Object.fromEntries(
            values.map((value) => [value.ccodPerson, value.nomPerson]),
          ),
        ),
      )
      .catch(() => undefined);
  }, [session.sociedadActual]);
  useEffect(() => {
    api
      .centers(session.sociedadActual)
      .then((values) =>
        setCenterNames(
          Object.fromEntries(
            values.map((value) => [value.ccodCencos, value.nomCencos]),
          ),
        ),
      )
      .catch(() => undefined);
    api
      .suppliers()
      .then((values) =>
        setSupplierNames(
          Object.fromEntries(
            values.map((value) => [value.ccodProveedor, value.nomProv]),
          ),
        ),
      )
      .catch(() => undefined);
  }, [session.sociedadActual]);
  // Nombres de materiales para la columna Material (nombre + código).
  useEffect(() => {
    const codes = [
      ...new Set(
        items.flatMap(
          (item) =>
            item.detalles
              ?.map((detail) => detail.codMaterial)
              .filter(Boolean) || [],
        ),
      ),
    ] as string[];
    const missing = codes.filter((c) => !materialNames[c]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async (code) => {
        try {
          const values = await api.materials(code);
          const match = values.find((value) => value.codMaterial === code);
          return [code, match?.nomMaterial || code] as const;
        } catch {
          return [code, code] as const;
        }
      }),
    ).then((values) =>
      setMaterialNames((current) => ({
        ...current,
        ...Object.fromEntries(values),
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function search(event: FormEvent) {
    event.preventDefault();
    setPage(0);
    load();
  }

  function clearFilters() {
    setQuery("");
    setCenter("");
    setStatus("");
    setPrio("");
    setFecIni("");
    setFecFin("");
    setPage(0);
  }

  async function inspect(item: Requisition) {
    if (!item.nroDoc) return;
    try {
      setSelected(await api.get(session.sociedadActual, item.nroDoc));
    } catch {
      setNotice("No se pudo cargar el detalle.");
    }
  }

  async function cancelDoc() {
    if (!selected?.nroDoc || !confirm("¿Anular esta requisición?")) return;
    try {
      await api.cancel(session.sociedadActual, selected.nroDoc);
      setSelected(null);
      setNotice("Requisición anulada.");
      load();
    } catch {
      setNotice("La operación no pudo completarse.");
    }
  }

  if (editor) {
    return (
      <RequisitionEditor
        session={session}
        initial={editor === "new" ? undefined : selected || undefined}
        total={total}
        logout={logout}
        onBack={() => {
          setEditor(null);
          setSelected(null);
        }}
        onSaved={() => {
          setEditor(null);
          setSelected(null);
          setNotice("Requisición guardada correctamente.");
          load();
        }}
        onDeleted={() => {
          setEditor(null);
          setSelected(null);
          setNotice("Requisición eliminada correctamente.");
          load();
        }}
      />
    );
  }

  return (
    <div className="editor-layout">
      <AppSidebar
        session={session}
        active="historial"
        total={total}
        onGoHistorial={() => {}}
        onGoRequisiciones={() => setEditor("new")}
        onLogout={logout}
      />
      <main className="blue-main">
        <header className="blue-header">
          <div>
            <p>
              Compras <span>/</span> Historial
            </p>
            <h1>Historial de requisiciones</h1>
            <small className="history-subtitle">
              Busca, filtra y consulta documentos registrados.
            </small>
          </div>
        </header>
        <section className="blue-content history-content">
          <div className="history-filter-card">
            <div className="history-filter-title">
              <h2>Filtros</h2>
              <small>Puedes combinar varios criterios</small>
            </div>
            <div className="history-filters">
              <label>
                Nro. documento
                <form className="history-search" onSubmit={search}>
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar..."
                  />
                </form>
              </label>
              <label>
                Centro de costo
                <select
                  value={center}
                  onChange={(event) => setCenter(event.target.value)}
                >
                  <option value="">Todos</option>
                  {centers.map((c) => (
                    <option key={c.ccodCencos} value={c.ccodCencos}>
                      {c.ccodCencos} - {c.nomCencos}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prioridad
                <select
                  value={prio}
                  onChange={(event) => setPrio(event.target.value)}
                >
                  <option value="">Todas</option>
                  {priorities.map((p) => (
                    <option key={p.cvalor} value={p.cvalor}>
                      {p.cnomValor}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fecha doc. ini
                <input
                  type="date"
                  value={fecIni}
                  onChange={(event) => setFecIni(event.target.value)}
                />
              </label>
              <label>
                Fecha doc. fin
                <input
                  type="date"
                  value={fecFin}
                  onChange={(event) => setFecFin(event.target.value)}
                />
              </label>
              <label>
                Estado
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="PENDIENTE">PENDIENTE</option>
                  <option value="ANULADO">ANULADO</option>
                </select>
              </label>
              <div className="history-filter-actions">
                <button
                  type="button"
                  className="history-clear"
                  onClick={clearFilters}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  className="history-search-button"
                  onClick={load}
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>
          <div className="history-table-card">
            <div className="history-table-head">
              <div>
                <h2>Requisiciones</h2>
                <small>
                  {total} requisición{total === 1 ? "" : "es"} ·{" "}
                  {
                    items.reduce(
                      (n, item) => n + (item.detalles?.length || 0),
                      0,
                    )
                  }{" "}
                  posición(es) en esta página
                </small>
              </div>
              <button
                className="history-create-link"
                onClick={() => setEditor("new")}
              >
                <Plus size={15} /> Nueva requisición
              </button>
            </div>
            <div className="blue-table-wrap">
              <table className="history-table">
                <thead>
                  <tr>
                    <th className="select-column">
                      <input type="checkbox" aria-label="Seleccionar todas" />
                    </th>
                    <th>Posición</th>
                    <th>Material</th>
                    <th>Grupo de productos</th>
                    <th>Cantidad</th>
                    <th>Cantidad de pedido</th>
                    <th>Proveedor asignado</th>
                    <th>Fecha de entrega</th>
                    <th>Centro</th>
                    <th>Estado de procesamiento</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="empty">
                        Cargando historial…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="empty">
                        No se encontraron requisiciones.
                      </td>
                    </tr>
                  ) : (
                    items.flatMap((item) =>
                      (
                        item.detalles?.length
                          ? item.detalles
                          : [{ cUnidad: "", cantid: 0 }]
                      ).map((detail, di) => {
                          const materialCode = detail.codMaterial;
                          const materialName = materialCode
                            ? materialNames[materialCode] || materialCode
                            : detail.observ || "Sin material";
                          const provCode =
                            detail.ccodProveedor || item.ccodProveedor;
                          const supplierName = provCode
                            ? supplierNames[provCode] || provCode
                            : "—";
                          const centerName =
                            centerNames[item.ccodCencos] || item.ccodCencos;
                          return (
                            <tr
                              key={`${item.nroDoc}-${detail.nroItem ?? di}`}
                            >
                              <td className="select-column">
                                <input
                                  type="checkbox"
                                  aria-label={`Seleccionar ${item.nroDoc}`}
                                />
                              </td>
                              <td
                                className="pos-cell"
                                style={{
                                  minWidth: 150,
                                  whiteSpace: "nowrap",
                                  overflow: "visible",
                                }}
                              >
                                <strong
                                  className="pos-doc"
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  {item.nroDoc || "—"}
                                </strong>
                                <small>/{detail.nroItem ?? di + 1}</small>
                              </td>
                              <td>
                                <a>{materialName}</a>
                                <small>
                                  {materialCode ? `(${materialCode})` : "—"}
                                </small>
                              </td>
                              <td>{groupOf(materialName)}</td>
                              <td>
                                {qty(detail.cantid, detail.cUnidad)}
                              </td>
                              <td>
                                {qty(detail.cantid, detail.cUnidad)}
                              </td>
                              <td>
                                <strong>{supplierName}</strong>
                                <small>{provCode || "—"}</small>
                              </td>
                              <td>{formatDate(item.fecReq)}</td>
                              <td>
                                <strong>{centerName}</strong>
                                <small>{item.ccodCencos}</small>
                              </td>
                              <td>
                                <span
                                  className={`blue-status ${item.estado === "ANULADO" ? "cancelled" : ""}`}
                                >
                                  {item.estado === "ANULADO"
                                    ? "Anulado"
                                    : "Pedido creado"}
                                </span>
                              </td>
                              <td className="history-actions">
                                <button
                                  title="Editar requisición"
                                  onClick={async () => {
                                    await inspect(item);
                                    setEditor(item);
                                  }}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  title="Ver detalle"
                                  onClick={() => inspect(item)}
                                >
                                  <ChevronDown size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )
                  )}
                </tbody>
              </table>
            </div>
            <footer className="history-pagination">
              <span>
                Página {pages ? page + 1 : 0} de {pages || 1}
              </span>
              <span>
                Mostrando {items.length} de {total} requisiciones
              </span>
              <div>
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={15} /> Anterior
                </button>
                <button
                  disabled={page + 1 >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente <ChevronRight size={15} />
                </button>
              </div>
            </footer>
          </div>
        </section>
      </main>
      {selected && !editor && (
        <DetailModal
          item={selected}
          sociedad={session.sociedadActual}
          onClose={() => setSelected(null)}
          onEdit={() => setEditor(selected)}
          onCancel={cancelDoc}
        />
      )}
      {notice && (
        <div className="blue-toast">
          {notice}
          <button onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
