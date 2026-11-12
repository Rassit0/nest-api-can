# Changelog — Gestión360 Backend (`nest-gestion360`)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.0] - 2026-11-12

Primera versión oficial formalmente identificada como línea base del backend de **Gestión360 (Sistema de Gestión CAN)**. Esta versión consolida el núcleo operativo, motor financiero, soporte multimoneda, portal docente y control de acceso desarrollados y estabilizados desde mayo de 2026.

### Added
- **Autenticación y Seguridad (RBAC):**
  - Autenticación mediante tokens JWT y Passport.
  - Decoradores y guards para control de acceso basado en roles (`RolesGuard`, `@Auth`).
  - Hashing seguro de contraseñas con `bcrypt`.
  - Soporte de contexto transaccional y auditoría global mediante `nestjs-cls`.
- **Gestión de Personas y Deportiva:**
  - Módulos para gestión integral de atletas, tutores, instructores y personal administrativo.
  - Temporadas deportivas (`seasons`), clubes, categorías y asignación de planteles.
- **Gestión Académica y Escuelas:**
  - Cursos, niveles, turnos, horarios y asignación de docentes.
  - Módulo y endpoints de registro de asistencia y seguimiento académico.
- **Motor Financiero y Membresías:**
  - Membresías de club y cursos con estados (`PENDING_ACTIVE`, `ACTIVE`, `SUSPENDED`, `INACTIVE`).
  - Generación programada de cargos y cuotas mensuales.
  - Cálculo automático de recargos por mora (*late fees*) mediante tareas programadas (`@nestjs/schedule`).
  - Regularización atómica de cuotas y moras acumuladas sin alteración destructiva de saldos.
- **Tesorería y Contabilidad:**
  - Cuentas financieras independientes con soporte multimoneda (BOB / USD).
  - Movimientos de caja: ingresos, egresos y transferencias entre cuentas.
  - Recibos y comprobantes de pago en PDF generados con `pdfmake`.
  - Reportes financieros y balances de tesorería exportables en Excel (`exceljs`).
  - Aperturas y arqueos/cierres de caja diarios por operador.
- **Operaciones Rápidas:**
  - Endpoints optimizados para transacciones ágiles de ventanilla y cobro en secretaría.
- **Portal Docente e Institucional:**
  - Endpoints de consulta de horarios, asistencias y supervisión académica.
- **Documentación Swagger / OpenAPI:**
  - Documentación interactiva en `/api/docs` sincronizada automáticamente con la versión oficial del sistema desde `package.json`.
- **Internacionalización y Validación:**
  - Validación de DTOs con `class-validator` y `class-transformer`.
  - Mensajes de validación y localización de errores con `nestjs-i18n`.

### Changed
- **Cuentas Financieras:**
  - Soporte para baja lógica y estado desactivado de cuentas bancarias/financieras, preservando la integridad referencial histórica.
- **Estandarización de Filtros Globales:**
  - Manejo unificado de excepciones de Prisma (`PrismaExceptionFilter`) y respuestas i18n HTTP.

### Fixed
- Regularización de cuotas y cobros históricos sin generar descuadres en el balance acumulado.
- Manejo seguro de transferencias entre cuentas financieras mediante transacciones ACID (`$transaction`).

### Security
- Filtrado estricto de campos de entrada con `whitelist` y `forbidNonWhitelisted` en el pipe global de validación.
- Sanitización de contenido HTML con `sanitize-html` para prevenir vulnerabilidades XSS.

---

## Convención de Versionado Futuro

A partir de la versión `1.0.0`, el backend se rige estrictamente por **Semantic Versioning (`MAJOR.MINOR.PATCH`)**:

- **MAJOR (X.0.0):** Cambios que rompen la compatibilidad de la API existente o reestructuraciones arquitectónicas mayores que requieren migración obligatoria del cliente.
- **MINOR (1.X.0):** Nuevas funcionalidades, nuevos módulos o endpoints que mantienen compatibilidad retrospectiva (*backwards-compatible*).
- **PATCH (1.0.X):** Correcciones de errores (*bugfixes*), parches de seguridad, optimización de consultas SQL/Prisma y ajustes sin alteración de contratos de API.

> Los tags Git oficiales se nombrarán como `v<MAJOR>.<MINOR>.<PATCH>` (ej. `v1.0.0`). Los commits cotidianos de desarrollo no incrementan la versión hasta que se empaqueta un release oficial.

