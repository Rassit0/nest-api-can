<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
  <a href="https://www.prisma.io/" target="blank"><img src="https://nx_docs_images.s3.amazonaws.com/prisma.png" width="120" alt="Prisma Logo" /></a>
</p>

<h1 align="center">Sistema Gestión CAN 360 - API</h1>

<p align="center">
  Backend robusto construido con <strong>NestJS</strong> y <strong>Prisma ORM</strong> para la gestión integral de membresías, alumnos, jugadores y facturación automatizada.
</p>

---

## 🚀 Tecnologías Principales

*   **Framework:** [NestJS](https://nestjs.com/)
*   **ORM:** [Prisma](https://www.prisma.io/)
*   **Base de Datos:** PostgreSQL
*   **Automatización:** `@nestjs/schedule` (Cron Jobs)
*   **Validación:** Joi / class-validator

---

## ⚙️ Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:
*   [Node.js](https://nodejs.org/) (v18 o superior recomendado)
*   [PostgreSQL](https://www.postgresql.org/) (Corriendo en local o en un servidor)

---

## 🛠️ Instalación y Configuración

1. **Clonar el repositorio e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar las Variables de Entorno:**
   Crea un archivo `.env` en la raíz del proyecto basándote en el ejemplo. (Ver sección de **Variables de Entorno** más abajo).

3. **Ejecutar migraciones de la base de datos:**
   Sincroniza el esquema de Prisma con tu base de datos:
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Poblar la base de datos (Seed):**
   *(Opcional pero recomendado para obtener datos iniciales como roles y configuraciones)*
   ```bash
   npx prisma db seed
   ```

---

## 💻 Ejecución del Proyecto

Para levantar el servidor de desarrollo en modo *Watch* (reinicio automático al guardar cambios):

```bash
npm run start:dev
```

Otros comandos útiles:
```bash
npm run build      # Construye la aplicación para Producción
npm run start:prod # Ejecuta la versión compilada en Producción
```

---

## 🔐 Variables de Entorno (.env)

El sistema utiliza validación estricta de variables de entorno mediante `Joi`. Debes crear un archivo `.env` con la siguiente estructura:

### Variables Obligatorias
```env
# Puerto de ejecución de la API
PORT=3000

# Credenciales de conexión a PostgreSQL
DATABASE_URL="postgresql://usuario:password@localhost:5432/nombre_db"

# Llave secreta para la generación de tokens JWT
JWT_SECRET="tu_super_secreto_aqui_123!"
```

### Variables Opcionales (Configuración Regional)
Esta variable controla el comportamiento de los Cron Jobs y los cálculos matemáticos de vencimiento para que se adapten a tu zona horaria.

```env
# Zona horaria del servidor para los Cron Jobs (Default: America/La_Paz)
APP_TIMEZONE="America/La_Paz"
```

---

## ⏱️ Tareas Programadas (Cron Jobs)

Este backend incluye procesos nocturnos automatizados que se ejecutan bajo la zona horaria definida en `APP_TIMEZONE`:

*   **Pausas de Membresías:** `00:30 AM`
*   **Cargos de Club:** `01:00 AM`
*   **Cargos de Escuela:** `01:30 AM`
*   **Recargos (Mora) Club:** `02:00 AM`
*   **Recargos (Mora) Escuela:** `02:30 AM`

> **Nota de Desarrollo:** No utilices `npx prisma db push` para actualizar la base de datos en este proyecto. Utiliza siempre el flujo de migraciones con `npx prisma migrate dev`.
