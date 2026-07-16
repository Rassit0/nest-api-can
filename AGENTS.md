## ⚠️ Reglas Críticas de Prisma

- **NUNCA usar `npx prisma db push`** en este proyecto.
- **SIEMPRE usar `npx prisma migrate dev`** al desarrollar cambios en el esquema. 
- *Razón:* `db push` no crea archivos de migración y causa desincronización (Drift) con el esquema real de la base de datos, lo cual genera conflictos en el entorno de producción que sí usa migraciones.
