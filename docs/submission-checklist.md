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

- [ ] instalación con `npm ci` en ambos paquetes desde un clon/copia limpia;
- [ ] MySQL nuevo con las 14 migraciones y cero pendientes;
- [ ] seed ADMIN idempotente y primer login;
- [ ] seed demo idempotente, si se usará durante la presentación;
- [ ] backend: 28/28 suites, 342/342 pruebas y lint;
- [ ] frontend: 15/15 suites, 104/104 pruebas, lint y build;
- [ ] flujo manual ADMIN completo;
- [ ] flujo manual MECANICO y ownership;
- [ ] lifecycle cliente/moto con soft delete/restore;
- [ ] una sola orden abierta y conflicto visible;
- [ ] asignación/reasignación y lifecycle de usuario protegido;
- [ ] regresión controlada, entrega y reapertura por garantía;
- [ ] ítems cerrados protegidos y total exacto;
- [ ] auditoría navegable sin datos sensibles;
- [ ] Postman importado y recorrido principal comprobado;
- [ ] revisión de secretos, paths locales, artefactos temporales y enlaces;
- [ ] `git diff --check` y working tree listo para el commit/tag decidido por el
  responsable.

No se crea tag ni se marca un gate futuro como aprobado desde este documento.
