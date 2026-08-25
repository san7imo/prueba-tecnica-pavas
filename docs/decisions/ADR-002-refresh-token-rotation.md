# ADR-002: Rotación persistida de refresh tokens

## Estado

Aceptado

## Contexto

Los access tokens cortos reducen exposición, pero exigen renovación segura. Las sesiones deben poder revocarse; logout debe invalidar la sesión actual y reutilizar una credencial rotada debe tratarse como posible robo.

## Decisión

Usar refresh JWT firmados entregados sólo mediante cookie `HttpOnly`. Persistir únicamente su SHA-256 digest junto con expiración, revocación, reemplazo y familia UUID.

Cada refresh bloquea la fila en una transacción MySQL, crea un reemplazo en la misma familia, revoca el predecesor y lo enlaza mediante `replaced_by_token_id`. Presentar un predecesor rotado revoca sólo tokens activos de esa familia. Cada login inicia otra familia.

## Alternativas consideradas

- **Access tokens largos:** amplían la ventana no revocable.
- **Refresh JWT stateless:** impiden logout, revocación dirigida y detección de replay eficaces.
- **Guardar refresh crudo:** una filtración de DB expondría credenciales Bearer utilizables.

## Consecuencias

- refresh/logout requieren consulta de DB;
- sesiones se revocan por separado y replay es detectable;
- row locking evita dos descendientes exitosos;
- un segundo uso concurrente revoca defensivamente la familia;
- el lifecycle añade complejidad justificada por seguridad.
