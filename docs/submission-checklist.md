# Checklist de entrega

Este checklist se ejecuta en HITO 20 sobre una base nueva. Los resultados de
HITO 18 son evidencia de regresión, pero no sustituyen la verificación final
posterior al cierre documental.

## Evidencia consolidada

- [x] matriz de aceptación: 235 filas `PASS`;
- [x] backend HITO 19: 28/28 suites, 342/342 pruebas y lint;
- [x] frontend HITO 19: 15/15 suites, 104/104 pruebas, lint y build;
- [x] catorce migraciones ejecutadas y cero pendientes en desarrollo;
- [x] colección Postman válida: 7 carpetas, 36 requests y todas las rutas;
- [x] README, API, arquitectura, negocio, base de datos, seguridad, pruebas,
  ADR y recorrido demo sincronizados con el producto;
- [x] riesgo residual de Sequelize/`uuid` documentado sin aplicar un downgrade
  incompatible.

## Gate de release — HITO 20

- [x] instalación con `npm ci` en ambos paquetes desde un clon/copia limpia;
- [x] MySQL nuevo con las 14 migraciones y cero pendientes;
- [x] seed ADMIN idempotente y primer login;
- [x] seed demo idempotente para la presentación;
- [x] backend: 28/28 suites, 342/342 pruebas y lint;
- [x] frontend: 15/15 suites, 104/104 pruebas, lint y build;
- [x] flujo manual ADMIN completo;
- [x] flujo manual MECANICO y ownership;
- [x] lifecycle cliente/moto con soft delete/restore;
- [x] una sola orden abierta y conflicto visible;
- [x] asignación/reasignación y lifecycle de usuario protegido;
- [x] los tres retrocesos, entrega y reapertura por garantía;
- [x] ítems cerrados protegidos y total exacto;
- [x] auditoría navegable sin datos sensibles;
- [x] Postman importable, scripts/rutas validados y health/login ejecutados;
- [x] revisión de secretos, paths locales, artefactos temporales y enlaces;
- [x] `git diff --check` y working tree listo para el commit/tag decidido por el
  responsable.

No se crea tag ni se marca un gate futuro como aprobado desde este documento.
