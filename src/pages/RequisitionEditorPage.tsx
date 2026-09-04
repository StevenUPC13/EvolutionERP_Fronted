import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { api, Detail, Requisition } from "../services/api";
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
const apiDate = (value: string) => `${value}T08:09:00`;
const blank = (): Row => ({
  codMaterial: "",
  cUnidad: "UND",
  cantid: 1,
  ncantidadRecibida: 0,
  observ: "",
});
const formatDoc = (n: string) => String(n).padStart(10, "0");

export default function RequisitionEditorPage({
  session,
  initial,
  total,
  logout,
  onBack,
  onSaved,
}: {
  session: Session;
  initial?: Requisition;
  total?: number;
  logout: () => void;
  onBack: () => void;
  onSaved: () => void;
}) {
  const activity =
    initial?.estado === "ANULADO"
      ? "ANULADO"
      : initial
        ? "MODIFICANDO"
        : "CREANDO";
  const activityNow = new Date();
  const [documentDate, setDocumentDate] = useState(day(initial?.fecDoc));
  const [requestDate, setRequestDate] = useState(day(initial?.fecReq));
  const [center, setCenter] = useState(initial?.ccodCencos || "");
  const [person, setPerson] = useState(initial?.ccodPerson || "");
  const [priority, setPriority] = useState(initial?.tipPrio || "");
  const [place, setPlace] = useState(initial?.lugarEntr || "");
  const [observations, setObservations] = useState(initial?.observ || "");
  const [rows, setRows] = useState<Row[]>(
    initial?.detalles?.length ? initial.detalles : [blank()],
  );
  const [centers, setCenters] = useState<
    { ccodCencos: string; nomCencos: string }[]
  >([]);
  const [people, setPeople] = useState<Record<string, string>[]>([]);
  const [priorities, setPriorities] = useState<Record<string, string>[]>([]);
  const [materials, setMaterials] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nextDocNumber, setNextDocNumber] = useState<string | null>(null);
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
  }, [session.sociedadActual]);
  useEffect(() => {
    if (!initial?.nroDoc) {
      api
        .nextDocument(session.sociedadActual)
        .then((num) => setNextDocNumber(String(num)))
        .catch(() => setNextDocNumber("1"));
    }
  }, [initial?.nroDoc, session.sociedadActual]);
  const changeRow = (index: number, key: keyof Row, value: string | number) =>
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  async function materialsFor(index: number, value: string) {
    changeRow(index, "codMaterial", value);
    if (value.length > 1) {
      try {
        setMaterials(await api.materials(value));
      } catch {
        setMaterials([]);
      }
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (
      !center ||
      !person ||
      rows.some((row) => !row.cUnidad || row.cantid <= 0)
    ) {
      setError("Completa centro, personal y todos los artículos.");
      return;
    }
    setBusy(true);
    setError("");
    const payload: Requisition = {
      codSociedad: session.sociedadActual,
      nroDoc: initial?.nroDoc || nextDocNumber || undefined,
      fecDoc: apiDate(documentDate),
      fecReq: apiDate(requestDate),
      ccodCencos: center,
      ccodPerson: person,
      tipPrio: priority,
      lugarEntr: place,
      observ: observations,
      detalles: rows.map((row, index) => ({ ...row, nroItem: index + 1 })),
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
  const dateLabel = activityNow.toLocaleDateString("es-PE");
  const timeLabel = activityNow.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const docDisplay = initial?.nroDoc
    ? formatDoc(initial.nroDoc)
    : nextDocNumber
      ? formatDoc(nextDocNumber)
      : "Cargando...";
  const docShort = initial?.nroDoc
    ? initial.nroDoc.match(/^0*(\d+)$/)
      ? initial.nroDoc.replace(/^0*(\d+)$/, "$1")
      : initial.nroDoc
    : nextDocNumber
      ? nextDocNumber.match(/^0*(\d+)$/)
        ? nextDocNumber.replace(/^0*(\d+)$/, "$1")
        : nextDocNumber
      : null;
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
      <div className="editor-page">
        <header className="editor-header">
          <button className="back-button" onClick={onBack}>
            <ArrowLeft size={17} /> Volver a requisiciones
          </button>
          <div>
            <p className="eyebrow">
              {initial ? "Edición de requisición" : "Nueva solicitud de compra"}
            </p>
            <h1>Registrar requisición</h1>
          </div>
          <div className="editor-header-actions">
            <div
              className={`editor-activity ${activity === "ANULADO" ? "is-cancelled" : ""}`}
            >
              <strong>ESTADO REQUISICIÓN: {activity}</strong>
              <small>
                {initial?.nroDoc
                  ? `Doc. ${docShort}`
                  : nextDocNumber
                    ? `Doc. ${docShort}`
                    : "Documento automático"}{" "}
                · {dateLabel} {timeLabel} · {session.username}
              </small>
            </div>
            <button type="button" className="secondary-button" onClick={onBack}>
              Deshacer
            </button>
            <button className="primary-button" disabled={busy} onClick={save}>
              <Save size={16} /> {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </header>
        <form className="editor-form" onSubmit={save}>
          <section className="editor-card editor-info">
            <div className="editor-grid">
              <label>
                Nro Doc
                <input
                  className="readonly-doc-input"
                  value={docDisplay}
                  readOnly
                />
              </label>
              <label>
                Fecha documento
                <input
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Fecha requerida
                <input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  required
                />
              </label>
              <label>
                Centro de costos
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
                Personal
                <select
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                  required
                >
                  <option value="">Seleccionar personal…</option>
                  {people.map((item, index) => {
                    const code =
                      item.ccodPerson || item.codigo || Object.values(item)[0];
                    const name =
                      item.nomPerson ||
                      item.nombre ||
                      Object.values(item)[1] ||
                      code;
                    return (
                      <option key={index} value={code}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                Prioridad
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">Seleccionar prioridad…</option>
                  {priorities.map((item, index) => {
                    const code =
                      item.cvalor ??
                      item.codConstante ??
                      item.codigo ??
                      Object.values(item)[0];
                    const label =
                      item.cnomValor ??
                      item.desConstante ??
                      item.descripcion ??
                      code;
                    return (
                      <option key={index} value={code}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="editor-wide">
                Lugar de entrega
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  placeholder="ENTREGA EN ALMACEN"
                />
              </label>
              <label className="editor-wide">
                Observaciones
                <textarea
                  rows={2}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Información adicional de la solicitud"
                />
              </label>
            </div>
          </section>
          <section className="editor-card">
            <div className="editor-section-head">
              <div>
                <h2>Artículos solicitados</h2>
                <p>Agrega los productos y cantidades requeridas.</p>
              </div>
              <button
                type="button"
                className="secondary-button add-item"
                onClick={() => setRows([...rows, blank()])}
              >
                <Plus size={16} /> Añadir nuevo artículo
              </button>
            </div>
            <div className="items-table-wrap">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Código / material</th>
                    <th>Unidad</th>
                    <th>Cantidad</th>
                    <th>Recibido</th>
                    <th>Observación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <input
                          list="editor-materials"
                          value={row.codMaterial || ""}
                          onChange={(event) =>
                            materialsFor(index, event.target.value)
                          }
                          placeholder="Buscar material…"
                        />
                      </td>
                      <td>
                        <input
                          value={row.cUnidad}
                          onChange={(event) =>
                            changeRow(index, "cUnidad", event.target.value)
                          }
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={row.cantid}
                          onChange={(event) =>
                            changeRow(
                              index,
                              "cantid",
                              Number(event.target.value),
                            )
                          }
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.ncantidadRecibida || 0}
                          onChange={(event) =>
                            changeRow(
                              index,
                              "ncantidadRecibida",
                              Number(event.target.value),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.observ || ""}
                          onChange={(event) =>
                            changeRow(index, "observ", event.target.value)
                          }
                          placeholder="Opcional"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="delete-item"
                          disabled={rows.length === 1}
                          onClick={() =>
                            setRows(
                              rows.filter((_, rowIndex) => rowIndex !== index),
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <datalist id="editor-materials">
              {materials.map((item, index) => (
                <option
                  key={index}
                  value={
                    item.codMaterial || item.codigo || Object.values(item)[0]
                  }
                >
                  {item.nomMaterial || item.descripcion || item.nombre}
                </option>
              ))}
            </datalist>
          </section>
          {error && <div className="alert error editor-error">{error}</div>}
          <footer className="editor-footer">
            <span>
              Estado: {activity} (Doc. {docShort ?? "Automático"})
            </span>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={onBack}
              >
                <X size={15} /> Descartar cambios
              </button>
              <button className="primary-button" disabled={busy}>
                <Save size={15} /> Actualizar registro
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
