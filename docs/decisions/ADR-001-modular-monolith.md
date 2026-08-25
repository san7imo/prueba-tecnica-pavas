# ADR-001: Monolito modular por capas

## Estado

Aceptado

## Contexto

La prueba implementa un único dominio de taller con cliente React, API Express y MySQL. Requiere transacciones sobre órdenes, totales e historial, entrega incremental y comprensión sencilla por parte del evaluador.

Se necesita separar HTTP, negocio y persistencia sin sistemas operativos ajenos al alcance.

## Decisión

Usar un monolito modular por capas. La aplicación Express se divide en routes, controllers, services, repositories, models, validators, middlewares y errors. MySQL es la fuente persistente mediante Sequelize y migraciones deterministas.

El frontend es una aplicación React separada y organizada por funcionalidades dentro del mismo repositorio.

## Alternativas consideradas

- **CRUD sin capas:** más rápido al inicio, pero mezcla reglas en controllers y debilita tests/transacciones.
- **Microservicios:** agregan red, despliegues y consistencia distribuida sin requisito de dominio o escala.
- **Funciones serverless:** fragmentan middleware y transacciones sin mejorar la evaluación local.

## Consecuencias

- ejecución local sencilla y transacciones directas;
- responsabilidades explícitas y pruebas de integración cohesionadas;
- pocas dependencias operativas;
- módulos comparten runtime y base, por lo que se exige disciplina entre capas;
- no hay despliegue/escalado independiente, aceptable para este MVP.

