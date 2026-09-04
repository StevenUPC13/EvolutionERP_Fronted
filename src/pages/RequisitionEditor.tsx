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
type EditorDetail = Detail;
const dateValue = (value?: string) =>
  value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
const dateTime = (date: string) => `${date}T08:09:00`;
const newDetail = (): EditorDetail => ({
  codMaterial: "",
  cUnidad: "UND",
  cantid: 1,
  ncantidadRecibida: 0,
  observ: "",
});

export default function RequisitionEditor({
  session,
  initial,
  onBack,
  onSaved,
}: {
  session: Session;
  initial?: Requisition;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [documentNumber, setDocumentNumber] = useState(
    initial?.nroDoc || "Automático",
  );
  const [documentDate, setDocumentDate] = useState(dateValue(initial?.fecDoc));
  const [requestDate, setRequestDate] = useState(dateValue(initial?.fecReq));
  const [center, setCenter] = useState(initial?.ccodCencos || "");
  const [person, setPerson] = useState(initial?.ccodPerson || "");
  const [priority, setPriority] = useState(initial?.tipPrio || "");
  const activityStatus =
    initial?.estado === "ANULADO"
      ? "ANULADO"
      : initial
        ? "MODIFICANDO"
        : "CREANDO";
  const activityDate = new Date();
  const activityDateLabel = activityDate.toLocaleDateString("es-PE");
  const activityTimeLabel = activityDate.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const status = activityStatus;
  const setStatus = (_value: string) => undefined;
  const [place, setPlace] = useState(initial?.lugarEntr || "");
  const [observations, setObservations] = useState(initial?.observ || "");
  const [details, setDetails] = useState<EditorDetail[]>(
    initial?.detalles?.length ? initial.detalles : [newDetail()],
  );
  const [centers, setCenters] = useState<
    { ccodCencos: string; nomCencos: string }[]
  >([]);
  const [people, setPeople] = useState<Record<string, string>[]>([]);
  const [priorities, setPriorities] = useState<Record<string, string>[]>([]);
  const [materials, setMaterials] = useState<Record<string, string>[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  function updateDetail(
    index: number,
    key: keyof EditorDetail,
    value: string | number,
  ) {
    setDetails((current) =>
      current.map((detail, i) =>
        i === index ? { ...detail, [key]: value } : detail,
      ),
    );
  }
  async function searchMaterial(index: number, value: string) {
    updateDetail(index, "codMaterial", value);
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
      details.some((d) => !d.cUnidad || !d.cantid || d.cantid <= 0)
    ) {
      setError("Completa centro, personal y todos los artículos.");
      return;
    }
    setBusy(true);
    setError("");
    const payload: Requisition = {
      codSociedad: session.sociedadActual,
      nroDoc: initial?.nroDoc,
      fecDoc: dateTime(documentDate),
      fecReq: dateTime(requestDate),
      ccodCencos: center,
      ccodPerson: person,
      tipPrio: priority,
      lugarEntr: place,
      observ: observations,
      detalles: details.map((d, index) => ({ ...d, nroItem: index + 1 })),
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
  return (
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
          <span
            className={`editor-status ${status === "ANULADO" ? "is-cancelled" : ""}`}
          >
            ESTADO: {status}
          </span>
          <button className="secondary-button" onClick={onBack}>
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
              <input value={documentNumber} readOnly />
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
                {centers.map((c) => (
                  <option key={c.ccodCencos} value={c.ccodCencos}>
                    {c.ccodCencos} - {c.nomCencos}
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
                {people.map((p, i) => {
                  const code = p.ccodPerson || p.codigo || Object.values(p)[0];
                  const name =
                    p.nomPerson || p.nombre || Object.values(p)[1] || code;
                  return (
                    <option key={i} value={code}>
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
                <option value="">Normal</option>
                {priorities.map((p, i) => {
                  const code =
                    p.codConstante || p.codigo || Object.values(p)[0];
                  return (
                    <option key={i} value={code}>
                      {p.desConstante || p.descripcion || code}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Estado
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>PENDIENTE</option>
                <option>MODIFICANDO</option>
                <option>ANULADO</option>
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
              onClick={() => setDetails([...details, newDetail()])}
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
                {details.map((detail, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        list="editor-materials"
                        value={detail.codMaterial || ""}
                        onChange={(e) => searchMaterial(index, e.target.value)}
                        placeholder="Buscar material…"
                      />
                    </td>
                    <td>
                      <input
                        value={detail.cUnidad}
                        onChange={(e) =>
                          updateDetail(index, "cUnidad", e.target.value)
                        }
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={detail.cantid}
                        onChange={(e) =>
                          updateDetail(index, "cantid", Number(e.target.value))
                        }
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={detail.ncantidadRecibida || 0}
                        onChange={(e) =>
                          updateDetail(
                            index,
                            "ncantidadRecibida",
                            Number(e.target.value),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={detail.observ || ""}
                        onChange={(e) =>
                          updateDetail(index, "observ", e.target.value)
                        }
                        placeholder="Opcional"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="delete-item"
                        disabled={details.length === 1}
                        onClick={() =>
                          setDetails(
                            details.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
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
            {materials.map((m, i) => (
              <option
                key={i}
                value={m.codMaterial || m.codigo || Object.values(m)[0]}
              >
                {m.nomMaterial || m.descripcion || m.nombre}
              </option>
            ))}
          </datalist>
        </section>
        {error && <div className="alert error editor-error">{error}</div>}
        <footer className="editor-footer">
          <span>
            Estado: {status} · Documento {documentNumber}
          </span>
          <div>
            <button type="button" className="secondary-button" onClick={onBack}>
              <X size={15} /> Descartar cambios
            </button>
            <button className="primary-button" disabled={busy}>
              <Save size={15} /> Actualizar registro
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
