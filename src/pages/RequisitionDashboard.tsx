import { FormEvent, useEffect, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
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
const firstDetail = (item: Requisition) => item.detalles?.[0];
const displayStatus = (item: Requisition) =>
  item.estado === "ANULADO" ? "ANULADO" : "ACTIVO";
const materialGroup = (name: string) => {
  const value = name.toUpperCase();
  if (value.includes("TAMBOR")) return "Tambores";
  if (value.includes("ABRAZADERA")) return "Abrazaderas";
  if (value.includes("PALLET")) return "Pallets";
  if (value.includes("ACEITE")) return "Aceites";
  return "Materiales";
};
const currency = (value?: number) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: "PEN",
      }).format(value);
const formatUnit = (unit?: string) =>
  (unit || "").toUpperCase().replace("C/U", "C/U");

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

  async function load() {
    setLoading(true);
    try {
      const result = await api.list(session.sociedadActual, page, 10, query, {
        cencos: center,
        estado: status === "ACTIVO" ? "" : status,
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
  }, [page, center, status]);
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
            values.map((value) => {
              const code =
                value.ccodProveedor || value.codigo || Object.values(value)[0];
              return [
                code,
                value.nomProv ||
                  value.nombre ||
                  Object.values(value)[1] ||
                  code,
              ];
            }),
          ),
        ),
      )
      .catch(() => undefined);
  }, [session.sociedadActual]);
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
    Promise.all(
      codes.map(async (code) => {
        try {
          const values = await api.materials(code);
          const match = values.find(
            (value) =>
              (value.codMaterial || value.codigo || Object.values(value)[0]) ===
              code,
          );
          return [
            code,
            match?.nomMaterial || match?.descripcion || match?.nombre || code,
          ] as const;
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
  }, [items]);
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
    if (!codes.length) return;
    Promise.all(
      codes.map(async (code) => {
        try {
          const results = await api.materials(code);
          const match = results.find(
            (item) =>
              (item.codMaterial || item.codigo || Object.values(item)[0]) ===
              code,
          );
          return [
            code,
            match?.nomMaterial || match?.descripcion || match?.nombre || code,
          ] as const;
        } catch {
          return [code, code] as const;
        }
      }),
    ).then((entries) =>
      setMaterialNames((current) => ({
        ...current,
        ...Object.fromEntries(entries),
      })),
    );
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

  async function remove(action: "cancel" | "delete") {
    if (
      !selected?.nroDoc ||
      !confirm(
        action === "cancel"
          ? "¿Anular esta requisición?"
          : "¿Eliminar esta requisición?",
      )
    )
      return;
    try {
      if (action === "cancel")
        await api.cancel(session.sociedadActual, selected.nroDoc);
      else await api.remove(session.sociedadActual, selected.nroDoc);
      setSelected(null);
      setNotice(
        action === "cancel" ? "Requisición anulada." : "Requisición eliminada.",
      );
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
                  <option value="01">01</option>
                  <option value="02">02</option>
                  <option value="03">03</option>
                </select>
              </label>
              <label>
                Fecha de doc. fin
                <input type="date" />
              </label>
              <label>
                Fecha de req. ini
                <input type="date" />
              </label>
              <label>
                Fecha de req. fin
                <input type="date" />
              </label>
              <label>
                Cod. persona
                <input placeholder="Código de personal" />
              </label>
              <label>
                Estado
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="ACTIVO">ACTIVO</option>
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
                <small>{total} registro(s) encontrados</small>
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
                    <th>Posición ↕</th>
                    <th>Material</th>
                    <th>Grupo de productos</th>
                    <th>Cantidad</th>
                    <th>Valor total</th>
                    <th>Proveedor</th>
                    <th>Fecha</th>
                    <th>Centro</th>
                    <th>Estado</th>
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
                    items.map((item) => {
                      const detail = firstDetail(item);
                      const materialCode = detail?.codMaterial;
                      const materialName = materialCode
                        ? materialNames[materialCode] || "Cargando material..."
                        : "Sin material";
                      const supplierName = item.ccodProveedor
                        ? supplierNames[item.ccodProveedor] ||
                          "Cargando proveedor..."
                        : "Sin proveedor";
                      const centerName =
                        centerNames[item.ccodCencos] || item.ccodCencos;
                      const productCount = item.detalles?.length || 0;
                      return (
                        <tr key={item.nroDoc}>
                          <td className="select-column">
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar ${item.nroDoc}`}
                            />
                          </td>
                          <td>
                            <strong>
                              {item.nroDoc ? `${item.nroDoc}/10` : "—"}
                            </strong>
                          </td>
                          <td>
                            <a>{materialName}</a>
                            <small>
                              {materialCode ? `(${materialCode})` : "—"}
                            </small>
                          </td>
                          <td>
                            {materialGroup(materialName)}
                            <small>
                              {productCount} producto
                              {productCount === 1 ? "" : "s"}
                            </small>
                          </td>
                          <td>
                            <strong>
                              {detail?.cantid || 0}{" "}
                              {formatUnit(detail?.cUnidad)}
                            </strong>
                          </td>
                          <td>{currency()}</td>
                          <td>
                            <strong>{supplierName}</strong>
                            <small>{item.ccodProveedor || "—"}</small>
                          </td>
                          <td>{formatDate(item.fecDoc)}</td>
                          <td>
                            <strong>{centerName}</strong>
                            <small>{item.ccodCencos}</small>
                          </td>
                          <td>
                            <span
                              className={`blue-status ${item.estado === "ANULADO" ? "cancelled" : ""}`}
                            >
                              {displayStatus(item)}
                            </span>
                          </td>
                          <td className="history-actions">
                            <button
                              title="Ver requisición"
                              onClick={() => inspect(item)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              title="Editar requisición"
                              onClick={async () => {
                                await inspect(item);
                                setEditor(item);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <footer className="history-pagination">
              <span>
                Página {pages ? page + 1 : 0} de {pages || 1}
              </span>
              <span>
                Mostrando {items.length} de {total}
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
          onClose={() => setSelected(null)}
          onEdit={() => setEditor(selected)}
          onCancel={() => remove("cancel")}
          onDelete={() => remove("delete")}
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
