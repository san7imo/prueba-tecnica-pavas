# Seguridad

## Frontera de seguridad

La API Express es la frontera autoritativa. Guardas y controles ocultos del frontend mejoran UX, pero autenticación, autorización, workflow, validación y restricciones se aplican de nuevo en backend. Orden global: Helmet → CORS credentialed de origen exacto → JSON acotado → autenticación/RBAC → validación → controller/service/repository → 404/error.

## Autenticación y contraseñas

bcrypt almacena únicamente `password_hash`. `BCRYPT_ROUNDS` admite 10–15 y usa 12 por defecto. Serializadores, atributos de repository y `toJSON` excluyen hashes.

El login normaliza email y devuelve el mismo `401 INVALID_CREDENTIALS` para email desconocido, contraseña errónea o usuario inactivo. Un rate limiter local al proceso protege sólo `POST /api/auth/login` y responde `429 LOGIN_RATE_LIMITED`.

## Access token

Los access JWT usan HS256, secreto dedicado y vida corta (`15m` por defecto). Claims: `sub`, `role`, `iat`, `exp`. La verificación restringe algoritmo, recarga el usuario desde MySQL y rechaza usuarios ausentes/inactivos o rol obsoleto.

Sólo se acepta `Authorization: Bearer`. Ausencia devuelve `AUTHENTICATION_REQUIRED`; formato, expiración, firma, propósito, rol obsoleto o usuario inactivo se normalizan a `INVALID_ACCESS_TOKEN`.

## Refresh token, rotación y replay

Los refresh JWT usan otro secreto y una vida mayor. El valor crudo sólo existe en cookie `HttpOnly` y memoria transitoria; MySQL guarda SHA-256 digest.

Cada login crea una familia UUID independiente. Refresh bloquea la fila presentada, crea un reemplazo en la misma familia, revoca el anterior y escribe `replaced_by_token_id` en una transacción. Reutilizar un predecesor rotado revoca descendientes activos de esa familia antes de devolver `401 INVALID_REFRESH_TOKEN`; otras familias siguen vigentes. Un segundo refresh concurrente se considera posible replay.

Logout revoca la sesión actual si existe, siempre limpia la cookie y es idempotente para el cliente. Logout global queda fuera del MVP.

## Cookies

La cookie de refresh es:

- `HttpOnly`;
- path `/api/auth`;
- `SameSite=Lax` por defecto;
- `Secure` en producción;
- duración alineada con el refresh token.

Clear-cookie reutiliza Path, HttpOnly, SameSite y Secure. El startup rechaza `SameSite=None` sin Secure y cookies no seguras en producción.

## CORS y CSRF

`FRONTEND_ORIGIN` es un único origen HTTP(S), nunca `*`. Sólo ese origen puede leer respuestas credentialed; otro recibe 403. Peticiones sin `Origin` siguen disponibles para Postman y clientes servidor.

Las mutaciones de negocio usan Bearer en memoria y la cookie sólo alcanza endpoints auth. SameSite, CORS exacto y path reducido limitan CSRF. No se añade token CSRF porque ninguna mutación general depende de cookies; debe reconsiderarse si el alcance de cookie se amplía o se habilita cross-site.

## Headers HTTP

Helmet se instala antes de rutas y desactiva `X-Powered-By`. HSTS sólo se emite en producción, durante un año y sin preload/subdominios no verificados. CSP se desactiva deliberadamente en la API JSON; el host del frontend debe aportar su CSP. `Cross-Origin-Resource-Policy: cross-origin` permite hosting separado mientras CORS controla lectura del navegador.

## Entrada, payloads y errores

Los endpoints de escritura usan allowlists, longitudes y rangos. IDs/paginación son acotados; body JSON máximo 100 KiB. JSON malformado devuelve `400 INVALID_JSON`; payload excesivo, `413 PAYLOAD_TOO_LARGE`.

Errores esperados exponen código/mensaje estable. Excepciones inesperadas devuelven `500 INTERNAL_ERROR` y `An unexpected error occurred.` No se serializan stack, SQL, JWT internos, paths, env, cookies, hashes ni secretos. Los fallos de conexión al iniciar se registran de forma genérica.

## Autorización, SQL y auditoría

Todas las rutas de negocio autentican primero. RBAC vive en middleware y, para destinos de estado/lifecycle, en servicio y transacción. Sólo `ADMIN` crea, edita, elimina o restaura clientes; `MECANICO` conserva lectura de clientes activos. Los lifecycle `deleted/all` y el detalle eliminado son administrativos.

Sequelize parametriza entrada. El único literal SQL de producción es una expresión fija y sin input para el total `DECIMAL`. UNIQUE, FKs, CHECK y ENUM agregan defensa. Totales, refresh, creación/auditoría y estado/auditoría son transaccionales con row locks.

Los dos ledgers son append-only. El actor de `audit_events` proviene de `req.user`, nunca del body, y se serializa sólo con ID/nombre. Snapshots y metadata se construyen campo por campo con allowlists por entidad/acción; passwords, hashes, tokens, cookies, secretos y valores de entorno no pueden entrar al evento. Sólo `ADMIN` puede leer el audit global y no existen rutas para modificarlo o borrarlo.

Los conflictos de duplicado exponen sólo IDs candidatos y campos coincidentes,
nunca datos de contacto ajenos. Delete/restore requieren reason; un override de
contacto exige confirmación booleana y justificación. Los locks Client → Bike
serializan delete de cliente contra creación de moto sin confiar en el frontend.

## Frontend, XSS y almacenamiento

El access token sólo vive en módulo/contexto; ningún token va a `localStorage` o `sessionStorage`. JavaScript no puede leer la cookie `HttpOnly`. Un cliente auth separado evita recursión; una promesa compartida coordina 401 concurrentes y cada petición reintenta una vez. Logout limpia memoria incluso si falla la red, y un refresh obsoleto no restaura una sesión cerrada.

React escapa texto. No se usa `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni `new Function`. Cualquier HTML enriquecido futuro requeriría sanitizador y revisión de amenazas.

## Validación de configuración

La API falla antes de conectar/escuchar cuando:

- `NODE_ENV` no es `development`, `test` o `production`;
- `FRONTEND_ORIGIN` falta, es inválido, incluye path/query/fragment o no usa HTTPS en producción;
- secretos JWT tienen menos de 32 caracteres, son iguales o son placeholders en producción;
- refresh no dura más que access;
- cookie de producción no es Secure;
- `SameSite=None` se usa sin Secure.

Sólo se versionan ejemplos seguros.

## Auditoría de dependencias

En la verificación del 2026-08-24, frontend reportó cero findings tanto completo como `--omit=dev`. Backend reportó dos registros moderados de una sola cadena transitiva: Sequelize 6.37.8 depende de `uuid` 8.3.2, afectado por un advisory de bounds-check cuando el caller suministra buffer a UUID v3/v5/v6.

La aplicación no invoca esas APIs y Sequelize 6.37.8 es la última versión v6. npm propone un downgrade semver-major a Sequelize 3.30.0, incompatible con la arquitectura. No se ejecutó `npm audit fix --force`.

Es un riesgo residual aceptado para la evaluación. Antes de producción se debe revisar una corrección compatible o planificar upgrade mayor.

## Riesgos residuales

- Rate limiter local: varias instancias requieren almacén compartido o WAF.
- No hay MFA, reset de contraseña, lockout ni gestor de secretos.
- JWT simétricos requieren distribución/rotación disciplinada.
- CORS no autentica; clientes no-browser pueden omitir `Origin`.
- La CSP corresponde al host frontend.
- No hay protección de último `ADMIN`.
- El advisory Sequelize/`uuid` debe permanecer visible.

## Recomendaciones de producción

- TLS en proxy confiable y política explícita de `trust proxy`;
- gestor de secretos y procedimiento de rotación;
- rate limiting distribuido;
- CSP del frontend;
- logs redactados y monitorización de 401/403/429/replay;
- backups de MySQL;
- tests y `npm audit` en CI/release.
