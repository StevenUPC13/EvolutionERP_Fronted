import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  HelpCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  api,
  Detail,
  Requisition,
  type Person,
  type Priority,
  type Supplier,
  type Material,
} from "../services/api";
import AppSidebar from "../components/AppSidebar";

type Session = {
  token: string;
  username: string;
  sociedades: string[];
  sociedadActual: string;
};
type Row = Detail;
const day = (value?: string) =>
  value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
// Hora local real al momento de guardar.
const apiDate = (value: string) => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const blank = (): Row => ({
  codMaterial: "",
  cUnidad: "UND",
  cantid: 1,
  ncantidadRecibida: 0,
  observ: "",
  ccodProveedor: "",
});
const formatDoc = (n: string) => String(n).padStart(10, "0");
const shortDoc = (n: string) =>
  /^0*(\d+)$/.test(n) ? n.replace(/^0*(\d+)$/, "$1") : n;

// ---------------------------------------------------------------------------
// Modal "AÑADIR NUEVO ARTÍCULO" (mockup 2 del Excel).
// Paso 1: buscar/seleccionar material + detalles. Paso 2: cantidad, fecha
// requerida y proveedor. La fecha requerida alimenta la Fecha Req. de la
// cabecera (el detalle no tiene fecha propia en el modelo del Excel).
// ---------------------------------------------------------------------------
function ArticleModal({
  docLabel,
  requestDate,
  suppliers,
  initial,
  onClose,
  onConfirm,
}: {
  docLabel: string;
  requestDate: string;
  suppliers: Supplier[];
  initial?: Row | null;
  onClose: () => void;
  onConfirm: (row: Row, newRequestDate: string) => void;
}) {
  const [query, setQuery] = useState(initial?.codMaterial || "");
  const [results, setResults] = useState<Material[]>([]);
  const [picked, setPicked] = useState(initial?.codMaterial || "");
  const [codigo, setCodigo] = useState(initial?.codMaterial || "");
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState(initial?.cUnidad || "UND");
  const [detalles, setDetalles] = useState(initial?.observ || "");
  const [cantidad, setCantidad] = useState(initial?.cantid ?? 1);
  const [fechaReq, setFechaReq] = useState(requestDate);
  const [proveedor, setProveedor] = useState(initial?.ccodProveedor || "");
  const [step, setStep] = useState(1);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const found = await api.materials(value.trim());
      setResults(found.slice(0, 20));
      if (!picked && found.length > 0) setPicked(found[0].codMaterial);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function select() {
    const match = results.find((r) => r.codMaterial === picked) || results[0];
    if (match) {
      setCodigo(match.codMaterial);
      setNombre(match.nomMaterial);
      setUnidad(match.cUnidad || "UND");
      setPicked(match.codMaterial);
    }
    setError("");
    setStep(2);
  }

  function confirm() {
    if (!cantidad || cantidad <= 0) {
      setError("Indica la cantidad solicitada (mayor a 0).");
      return;
    }
    if (!codigo && !detalles.trim()) {
      setError("Selecciona un material o describe el artículo en Detalles.");
      return;
    }
    if (!fechaReq) {
      setError("Indica la fecha requerida.");
      return;
    }
    onConfirm(
      {
        codMaterial: codigo || "",
        cUnidad: (unidad || "UND").toUpperCase(),
        cantid: cantidad,
        ncantidadRecibida: initial?.ncantidadRecibida || 0,
        observ: detalles,
        ccodProveedor: proveedor || "",
      },
      fechaReq,
    );
  }

  return (
    <div className="modal-backdrop">
      <section className="modal article-modal">
        <header className="article-modal-head">
          <div>
            <p className="eyebrow">Artículo de la requisición</p>
            <h2>
              {initial ? "Editar artículo" : "Añadir nuevo artículo"}{" "}
              <small>(Doc. {docLabel})</small>
            </h2>
          </div>
          <button className="close-button" onClick={onClose} title="Cerrar">
            <X size={19} />
          </button>
        </header>

        {step === 1 ? (
          <div className="article-step">
            <div className="article-search-row">
              <div className="article-search-box">
                <input
                  value={query}
                  onChange={(e) => search(e.target.value)}
                  placeholder="Buscar por Nombre o Código..."
                />
                <Search size={16} />
              </div>
              <button
                type="button"
                className="primary-button compact"
                onClick={select}
              >
                SELECCIONAR
              </button>
            </div>
            <select
              className="article-results"
              size={4}
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              onDoubleClick={select}
            >
              {searching && <option>Cargando…</option>}
              {!searching &&
                results.map((r) => (
                  <option key={r.codMaterial} value={r.codMaterial}>
                    {r.codMaterial} - {r.nomMaterial}
                  </option>
                ))}
              {!searching && results.length === 0 && (
                <option value="">
                  {query.trim().length >= 2
                    ? "Sin resultados (puedes describir el artículo abajo)"
                    : "Escribe al menos 2 letras o deja vacío para texto libre"}
                </option>
              )}
            </select>
            <div className="article-grid">
              <label>
                Artículo Código:
                <input value={codigo} readOnly placeholder="—" />
              </label>
              <label>
                Artículo Nombre:
                <input value={nombre} readOnly placeholder="—" />
              </label>
              <label className="article-wide">
                Detalles:
                <textarea
                  rows={3}
                  value={detalles}
                  onChange={(e) => setDetalles(e.target.value)}
                  placeholder="• ACERO INOXIDABLE&#10;• 1 1/2 PULGADAS"
                />
              </label>
              <label>
                Unidad:
                <input value={unidad} readOnly />
              </label>
            </div>
          </div>
        ) : (
          <div className="article-step">
            <div className="article-summary">
              <strong>
                {codigo ? `${codigo} — ${nombre || "Material"}` : "Artículo de texto libre"}
              </strong>
              <small>
                {unidad} {detalles ? `· ${detalles.split("\n")[0]}` : ""}
              </small>
            </div>
            <div className="article-grid three">
              <label>
                Cantidad Solicitada:
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  autoFocus
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                />
              </label>
              <label>
                Fecha Requerida:
                <input
                  type="date"
                  value={fechaReq}
                  onChange={(e) => setFechaReq(e.target.value)}
                />
              </label>
              <label>
                Seleccionar Proveedor Sugerido:
                <select
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  size={3}
                >
                  <option value="">Sin proveedor…</option>
                  {suppliers.map((s) => (
                    <option key={s.ccodProveedor} value={s.ccodProveedor}>
                      {s.nomProv}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {error && <p className="alert error">{error}</p>}

        <div className="article-steps">
          <span className={step === 1 ? "active" : ""}>1. Detalles Artículo</span>
          <span>→</span>
          <span className={step === 2 ? "active" : ""}>
            2. Confirmar Cantidad
          </span>
        </div>

        <footer className="article-actions">
          <button
            type="button"
            className="article-cancel"
            onClick={onClose}
          >
            CANCELAR
          </button>
          <div>
            {step === 2 && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep(1)}
              >
                VOLVER
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                className="primary-button"
                onClick={select}
              >
                CONTINUAR →
              </button>
            ) : (
              <button
                type="button"
                className="article-add"
                onClick={confirm}
              >
                {initial ? "GUARDAR CAMBIOS" : "[+] AÑADIR A LA LISTA"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor de requisición (mockup 1 del Excel).
// ---------------------------------------------------------------------------
export default function RequisitionEditorPage({
  session,
  initial,
  total,
  logout,
  onBack,
  onSaved,
  onDeleted,
}: {
  session: Session;
  initial?: Requisition;
  total?: number;
  logout: () => void;
  onBack: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}) {
  const activity =
    initial?.estado === "ANULADO"
      ? "ANULADO"
      : initial
        ? "MODIFICANDO"
        : "CREANDO";
  const now = new Date();
  const dateLabel = now.toLocaleDateString("es-PE");
  const timeLabel = now.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const [documentDate, setDocumentDate] = useState(day(initial?.fecDoc));
  const [requestDate, setRequestDate] = useState(day(initial?.fecReq));
  const [center, setCenter] = useState(initial?.ccodCencos || "");
  const [person, setPerson] = useState(initial?.ccodPerson || "");
  const [priority, setPriority] = useState(initial?.tipPrio || "");
  const [supplier, setSupplier] = useState(initial?.ccodProveedor || "");
  const [place, setPlace] = useState(initial?.lugarEntr || "");
  const [observations, setObservations] = useState(initial?.observ || "");
  const [rows, setRows] = useState<Row[]>(
    initial?.detalles?.length ? initial.detalles : [],
  );
  const [centers, setCenters] = useState<
    { ccodCencos: string; nomCencos: string }[]
  >([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialNames, setMaterialNames] = useState<Record<string, string>>(
    {},
  );
  const [modal, setModal] = useState<{ open: boolean; index: number | null }>({
    open: false,
    index: null,
  });
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .centers(session.sociedadActual)
      .then(setCenters)
      .catch(() => []);
    api
      .people(session.sociedadActual)
      .then(setPeople)
      .catch(() => []);
    api
      .priorities(session.sociedadActual)
      .then(setPriorities)
      .catch(() => []);
    api
      .suppliers()
      .then(setSuppliers)
      .catch(() => []);
  }, [session.sociedadActual]);

  // Nombre de cada material para mostrarlo bajo el código (mockup: la
  // columna Material lleva el nombre y las notas van en filas debajo).
  useEffect(() => {
    const codes = [...new Set(rows.map((r) => r.codMaterial).filter(Boolean))];
    const missing = codes.filter(
      (c): c is string => !!c && !materialNames[c],
    );
    if (missing.length === 0) return;
    Promise.all(
      missing.map(async (code) => {
        try {
          const found = await api.materials(code);
          const match = found.find((m) => m.codMaterial === code);
          return [code, match?.nomMaterial || code] as const;
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
  }, [rows]);

  const docDisplay = initial?.nroDoc
    ? formatDoc(initial.nroDoc)
    : "Automático";
  const docShort = initial?.nroDoc ? shortDoc(initial.nroDoc) : null;
  const docLabel = docShort ?? "Automático";
  const supplierName =
    suppliers.find((s) => s.ccodProveedor === supplier)?.nomProv || "";

  function reset() {
    setDocumentDate(day(initial?.fecDoc));
    setRequestDate(day(initial?.fecReq));
    setCenter(initial?.ccodCencos || "");
    setPerson(initial?.ccodPerson || "");
    setPriority(initial?.tipPrio || "");
    setSupplier(initial?.ccodProveedor || "");
    setPlace(initial?.lugarEntr || "");
    setObservations(initial?.observ || "");
    setRows(initial?.detalles?.length ? initial.detalles : []);
    setError("");
  }

  function confirmArticle(row: Row, newRequestDate: string) {
    setRequestDate(newRequestDate);
    setRows((current) =>
      modal.index == null
        ? [...current, row]
        : current.map((r, i) => (i === modal.index ? row : r)),
    );
    setModal({ open: false, index: null });
  }

  function removeNote(rowIndex: number, lineIndex: number) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== rowIndex) return row;
        const lines = (row.observ || "")
          .split("\n")
          .filter((l) => l.trim() !== "");
        lines.splice(lineIndex, 1);
        return { ...row, observ: lines.join("\n") };
      }),
    );
  }

  // Filas físicas de la tabla: cada artículo + una fila por cada línea de
  // sus notas (observ), como en el mockup del Excel.
  const physicalRows: (
    | { kind: "item"; rowIndex: number }
    | { kind: "note"; rowIndex: number; lineIndex: number; text: string }
  )[] = [];
  rows.forEach((row, rowIndex) => {
    physicalRows.push({ kind: "item", rowIndex });
    // Solo los artículos con código despliegan sus notas en filas debajo;
    // las filas "*" de texto libre ya muestran su descripción en la fila.
    if (!row.codMaterial) return;
    (row.observ || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "")
      .forEach((text, lineIndex) =>
        physicalRows.push({ kind: "note", rowIndex, lineIndex, text }),
      );
  });

  async function save(event: FormEvent) {
    event.preventDefault();
    if (
      !center ||
      !person ||
      rows.length === 0 ||
      rows.some((row) => !row.cUnidad || row.cantid <= 0)
    ) {
      setError(
        "Completa centro, personal y agrega al menos un artículo con cantidad.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const payload: Requisition = {
      codSociedad: session.sociedadActual,
      // Sin nroDoc en creación: el backend lo genera con EnumRangos (app=COM).
      nroDoc: initial?.nroDoc,
      fecDoc: apiDate(documentDate),
      fecReq: apiDate(requestDate),
      ccodCencos: center,
      ccodPerson: person,
      tipPrio: priority || undefined,
      ccodProveedor: supplier || undefined,
      lugarEntr: place ? place.toUpperCase() : place,
      observ: observations ? observations.toUpperCase() : observations,
      detalles: rows.map((row, index) => ({
        ...row,
        codMaterial: row.codMaterial || undefined,
        cUnidad: (row.cUnidad || "").toUpperCase(),
        observ: row.observ ? row.observ.toUpperCase() : undefined,
        ccodProveedor: row.ccodProveedor || undefined,
        // Al crear, lo recibido siempre es 0 (se registra en la recepción).
        ncantidadRecibida: initial?.nroDoc ? row.ncantidadRecibida || 0 : 0,
        nroItem: index + 1,
      })),
    };
    try {
      if (initial?.nroDoc)
        await api.update(session.sociedadActual, initial.nroDoc, payload);
      else await api.create(payload);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la requisición.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !initial?.nroDoc ||
      !window.confirm(
        `¿Eliminar la requisición ${initial.nroDoc}? Esta acción no se puede deshacer.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api.remove(session.sociedadActual, initial.nroDoc);
      if (onDeleted) onDeleted();
      else onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo eliminar la requisición.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor-layout">
      <AppSidebar
        session={session}
        active="requisiciones"
        total={total}
        onGoHistorial={onBack}
        onGoRequisiciones={() => {}}
        onLogout={logout}
      />
      <main className="blue-main">
        <header className="blue-header">
          <div>
            <p>
              Compras <span>/</span> Requisiciones
            </p>
            <h1>
              {initial ? "Requisición de compra" : "Nueva requisición"}
            </h1>
            <small className="history-subtitle">
              {initial
                ? `Editando documento ${docDisplay}`
                : "Completa la cabecera y añade los artículos solicitados."}
            </small>
          </div>
          <div className="blue-header-side">
            <div
              className={`req-statusbox ${activity === "ANULADO" ? "is-cancelled" : ""}`}
            >
              <small>Requisition Status</small>
              <strong>
                ESTADO: {activity} (DOC. {docLabel})
              </strong>
              <span>
                {dateLabel} {timeLabel} - {session.username}
              </span>
            </div>
            <button className="back-button" onClick={onBack}>
              <ArrowLeft size={17} /> Volver
            </button>
          </div>
        </header>
        <section className="blue-content">
        <form className="editor-form req-form" onSubmit={save}>
          <section className="editor-card editor-info">
            <div className="editor-grid req-grid">
              <label>
                Nro Doc:
                <input
                  className="readonly-doc-input"
                  value={docDisplay}
                  readOnly
                />
              </label>
              <label>
                Fech Doc:
                <input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Fech Req:
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Centro de Costos:
                <select
                  value={center}
                  onChange={(e) => setCenter(e.target.value)}
                  required
                >
                  <option value="">Seleccionar centro…</option>
                  {centers.map((item) => (
                    <option key={item.ccodCencos} value={item.ccodCencos}>
                      {item.ccodCencos} - {item.nomCencos}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Personal:
                <select
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  required
                >
                  <option value="">Seleccionar personal…</option>
                  {people.map((item) => (
                    <option key={item.ccodPerson} value={item.ccodPerson}>
                      {item.nomPerson}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                T. Prioridad:
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">NORMAL</option>
                  {priorities.map((item) => (
                    <option key={item.cvalor} value={item.cvalor}>
                      {item.cnomValor}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lugar Entr:
                <input
                  value={place}
                  maxLength={200}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="ENTREGA EN ALMACEN LA MOLINA"
                />
              </label>
              <label>
                Cod Prov:
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">—</option>
                  {suppliers.map((item) => (
                    <option key={item.ccodProveedor} value={item.ccodProveedor}>
                      {item.ccodProveedor}
                    </option>
                  ))}
                </select>
              </label>
              <label className="req-prov-name">
                Proveedor Sugerido:
                <input value={supplierName} readOnly placeholder="—" />
              </label>
              <label className="editor-wide">
                Observaciones:
                <textarea
                  rows={2}
                  value={observations}
                  maxLength={400}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="LOS PRODUCTOS DEBEN SER ENTREGADOS LA SEMANA 25"
                />
              </label>
            </div>
          </section>

          <section className="editor-card">
            <div className="editor-section-head">
              <div>
                <h2>Artículos solicitados</h2>
                <p>
                  {rows.length} artículo{rows.length === 1 ? "" : "s"} en la
                  lista.
                </p>
              </div>
              <button
                type="button"
                className="btn-add-article"
                onClick={() => setModal({ open: true, index: null })}
              >
                <Plus size={16} /> AÑADIR NUEVO ARTÍCULO
              </button>
            </div>
            <div className="items-table-wrap">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Código</th>
                    <th>Material</th>
                    <th>Unidad</th>
                    <th>Cantidad</th>
                    <th>RECIB</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="empty">
                        Sin artículos. Usa “Añadir nuevo artículo”.
                      </td>
                    </tr>
                  )}
                  {physicalRows.map((pr, n) => {
                    const row = rows[pr.rowIndex];
                    if (pr.kind === "note") {
                      return (
                        <tr key={`${pr.rowIndex}-${n}`} className="note-row">
                          <td>{n + 1}</td>
                          <td />
                          <td className="note-text">• {pr.text}</td>
                          <td />
                          <td className="num">,00</td>
                          <td className="num">0.00</td>
                          <td className="row-actions">
                            <button
                              type="button"
                              title="Editar artículo"
                              onClick={() =>
                                setModal({ open: true, index: pr.rowIndex })
                              }
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              title="Eliminar nota"
                              onClick={() =>
                                removeNote(pr.rowIndex, pr.lineIndex)
                              }
                            >
                              <Trash2 size={15} />
                            </button>
                            <button
                              type="button"
                              title="Añadir artículo"
                              className="add"
                              onClick={() =>
                                setModal({ open: true, index: null })
                              }
                            >
                              <Plus size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={`${pr.rowIndex}-${n}`}>
                        <td>{n + 1}</td>
                        <td>{row.codMaterial || "*"}</td>
                        <td>
                          <strong>
                            {row.codMaterial
                              ? materialNames[row.codMaterial] ||
                                row.codMaterial
                              : row.observ || "*"}
                          </strong>
                          {row.ccodProveedor && (
                            <small> · Prov. {row.ccodProveedor}</small>
                          )}
                        </td>
                        <td>{row.cUnidad}</td>
                        <td className="num">
                          {Number(row.cantid).toFixed(2)}
                        </td>
                        <td className="num">
                          {Number(row.ncantidadRecibida || 0).toFixed(2)}
                        </td>
                        <td className="row-actions">
                          <button
                            type="button"
                            title="Editar artículo"
                            onClick={() =>
                              setModal({ open: true, index: pr.rowIndex })
                            }
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            title="Eliminar artículo"
                            onClick={() =>
                              setRows(
                                rows.filter((_, i) => i !== pr.rowIndex),
                              )
                            }
                          >
                            <Trash2 size={15} />
                          </button>
                          <button
                            type="button"
                            title="Añadir artículo"
                            className="add"
                            onClick={() =>
                              setModal({ open: true, index: null })
                            }
                          >
                            <Plus size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {error && <div className="alert error editor-error">{error}</div>}

          <footer className="editor-footer req-footer">
            <span>
              Estado: {activity === "MODIFICANDO" ? "Modificando" : activity} (Doc.{" "}
              {docLabel})
            </span>
            <div>
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={reset}
              >
                <RotateCcw size={15} /> DESECHAR CAMBIOS
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={onBack}
              >
                Volver
              </button>
              {initial?.nroDoc && (
                <button
                  type="button"
                  className="secondary-button danger"
                  disabled={busy}
                  onClick={remove}
                  title="Eliminar la requisición"
                >
                  <Trash2 size={15} /> ELIMINAR
                </button>
              )}
              <button className="primary-button" disabled={busy}>
                <Save size={15} />{" "}
                {busy
                  ? "Guardando…"
                  : initial
                    ? "ACTUALIZAR REGISTRO"
                    : "GUARDAR CAMBIOS"}
              </button>
              <button
                type="button"
                className="help-button"
                title="Ayuda"
                onClick={() => setHelp(!help)}
              >
                <HelpCircle size={16} /> AYUDA
              </button>
            </div>
          </footer>
          {help && (
            <div className="help-popover">
              <strong>Cómo registrar:</strong>
              <ol>
                <li>Completa centro de costos, personal y fechas.</li>
                <li>
                  Pulsa “Añadir nuevo artículo”, busca el material por nombre o
                  código y pulsa SELECCIONAR.
                </li>
                <li>
                  Indica cantidad, fecha requerida y proveedor, y pulsa “Añadir
                  a la lista”.
                </li>
                <li>
                  Las filas sin código (texto con *) sirven para precisar
                  detalles del artículo.
                </li>
                <li>Pulsa “Actualizar registro” para guardar.</li>
              </ol>
            </div>
          )}
        </form>
        </section>
      </main>

      {modal.open && (
        <ArticleModal
          docLabel={docLabel}
          requestDate={requestDate}
          suppliers={suppliers}
          initial={modal.index == null ? null : rows[modal.index]}
          onClose={() => setModal({ open: false, index: null })}
          onConfirm={confirmArticle}
        />
      )}
    </div>
  );
}
