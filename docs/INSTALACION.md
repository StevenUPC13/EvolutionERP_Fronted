# EvolutionERP — Guía de instalación y arranque

Plataforma de Requisición de Compras: backend Spring Boot + frontend React + PostgreSQL.
Esta guía deja la plataforma corriendo desde cero para poder testearla.

---

## 1. Requisitos (iniciadores / IDEs y runtimes)

| Qué | Versión probada | Notas |
|---|---|---|
| Java JDK | 21 (mínimo 17 según `pom.xml`) | Backend Spring Boot 3.3.5 |
| Maven | Wrapper incluido (`mvnw`) | No requiere instalación global |
| Node.js | v26 + npm v11 | Frontend Vite 6 + React 18 + TS 5.7 |
| PostgreSQL | 18 (mínimo 12 por columna generada) | Flyway crea todo solo |
| IDE backend | IntelliJ IDEA o VS Code + Extension Pack for Java | — |
| IDE frontend | VS Code | — |

Puertos usados: **backend `8085`**, **frontend `5173`**, **PostgreSQL `5432`**.

Repositorios:

- Backend: `EvolutionERPBackend/` (puerto 8085, `server.port=8085`)
- Frontend: este repo (Vite, puerto 5173, `VITE_API_URL=http://localhost:8085`)

---

## 2. Base de datos — instalación correcta paso a paso

No hay script manual que correr: **Flyway aplica `V1 → V2 → V3` solo al arrancar el backend**.
Lo único que debes crear a mano es la base vacía.

```bash
# 1. Instalar PostgreSQL 12+ (probado en 18.6) y verificar:
psql --version

# 2. Crear la base vacía (el schema evo y las tablas las crea Flyway):
createdb -h localhost -U postgres evolution_erp
# o dentro de psql: CREATE DATABASE evolution_erp;

# 3. Configurar credenciales de conexión (el backend usa estas por defecto):
#    usuario: postgres / clave: postgre / url: jdbc:postgresql://localhost:5432/evolution_erp
#    Para cambiarlas sin editar archivos, exportar:
export DATABASE_URL=jdbc:postgresql://localhost:5432/evolution_erp
export DATABASE_USERNAME=postgres
export DATABASE_PASSWORD=postgre
#    (En Windows PowerShell: $env:DATABASE_PASSWORD="tu_clave")

# 4. Arrancar el backend (ver sección 3). En el log debes ver:
#    Migrating schema "evo" to version "1 - init evo schema"
#    Migrating schema "evo" to version "2 - seed"
#    Migrating schema "evo" to version "3 - evo only security"
#    Successfully applied 3 migrations ... now at version v3
#    Initialized JPA EntityManagerFactory ... Started EvolutionErpApplication

# 5. Verificar seed:
psql -h localhost -U postgres -d evolution_erp -c "SELECT count(*) FROM evo.esociedad;"
#    Sociedades: 3 | Centros de costo: 5 | Constantes: 12 | Materiales: 7
#    Requisición ejemplo: sociedad 100, doc 0000000024
```

> ⚠️ **No editar `V1__*.sql`, `V2__*.sql` ni `V3__*.sql`** una vez aplicados:
> Flyway valida el checksum y el backend dejará de arrancar.
> Cualquier ajuste futuro va en una migración nueva (`V4__...sql`).

---

## 3. Backend — arranque

```bash
cd EvolutionERPBackend

# Desarrollo (compila y arranca en 8085):
./mvnw spring-boot:run
# En Windows: mvnw.cmd spring-boot:run

# Verificación rápida:
curl http://localhost:8085/actuator/health 2>/dev/null || echo "abrir http://localhost:8085/swagger-ui.html"
```

- Config: `src/main/resources/application.properties`
  (`spring.jpa.hibernate.ddl-auto=validate` → la BD debe existir vía Flyway, Hibernate no la crea).
- Documentación API: `http://localhost:8085/swagger-ui.html` (springdoc).
- `JWT_SECRET`: en desarrollo usa el fallback del properties; en producción exportar
  `JWT_SECRET` (Base64 ≥ 64 bytes, HS512).

---

## 4. Frontend — arranque

```bash
cd EvolutionERP_Fronted

# 1. Instalar dependencias (node_modules NO se sube a git):
npm ci        # instalación limpia desde package-lock.json
# o: npm install

# 2. Configurar URL del backend:
cp .env.example .env
# .env contiene: VITE_API_URL=http://localhost:8085
# (el código usa ese valor con fallback a http://localhost:8085 si falta — ver src/api.ts)

# 3. Arrancar en desarrollo:
npm run dev
# Abrir http://localhost:5173

# 4. Build de producción (opcional):
npm run build   # genera dist/ (tampoco se sube a git)
npm run preview
```

---

## 5. Credenciales y datos de prueba

| Usuario | Clave | Rol |
|---|---|---|
| `master` | `master123` | ADMIN |
| `admin` | `admin123` | ADMIN |

Flujo de prueba:

1. Abrir `http://localhost:5173` → login con `master` / `master123`.
2. Seleccionar sociedad (seed: `100` INTERCORP RETAIL, `A13` ATOCONGO, `1100` LA REJA).
3. Abrir historial → debe verse la requisición `100 / 0000000024` (8 ítems).
4. Crear una requisición nueva → el correlativo lo genera el backend
   (`evo.next_correlativo` + `enumrangos`, app `COM`, 12 dígitos con ceros).
5. Prioridades vienen de `econstantes` app `PRIO`: `001` NORMAL, `002` URGENTE, `003` EMERGENCIA.

---

## 6. Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| Backend: `Connection refused` a Postgres | PostgreSQL apagado o base `evolution_erp` no creada. Crear la BD y revisar `DATABASE_*`. |
| Backend: `Checksum mismatch` Flyway | Se editó un V1/V2/V3 ya aplicado. Revertir el archivo o reparar con `flyway repair` solo si sabes lo que haces; a futuro usar V4. |
| Backend: `relation "evo...." does not exist` | Se arrancó con `ddl-auto=validate` y Flyway deshabilitado. No deshabilitar `spring.flyway.enabled`. |
| Frontend: `Failed to fetch` / lista vacía | Backend apagado o `VITE_API_URL` apunta a otro puerto. Debe ser `http://localhost:8085`. Reiniciar `npm run dev` tras cambiar `.env`. |
| Frontend: 401 → vuelve al login | Token expirado (`jwt.expiration`). Ingresar de nuevo; es el comportamiento esperado (`src/api.ts`). |
| Puerto ocupado | Backend: cambiar `server.port`; Frontend: `vite.config.ts → server.port`. Si cambias el backend, actualiza `.env`. |

---

## 7. Estructura mínima del proyecto

```text
EvolutionERPBackend/
  src/main/java/com/evolutionerp/{entities,dtos,controllers,servicesimplements,...}
  src/main/resources/application.properties   # puerto 8085, datasource, flyway, jwt
  src/main/resources/db/migration/V1__init_evo_schema.sql
  src/main/resources/db/migration/V2__seed.sql
  src/main/resources/db/migration/V3__evo_only_security.sql

EvolutionERP_Fronted/   (este repo)
  src/api.ts        # cliente HTTP, usa VITE_API_URL, token evo_token
  src/main.tsx      # entrada React
  src/pages/        # login, selección de sociedad, historial, editor
  .env.example      # plantilla (VITE_API_URL=http://localhost:8085)
  docs/INSTALACION.md  # esta guía
```
