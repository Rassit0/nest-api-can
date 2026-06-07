# 1. Fase de construcción
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copiamos todo el código fuente
COPY . .

# Generamos el cliente en tu ruta personalizada e indicamos a Nest que compile
RUN npx prisma generate

# Nota: Si tu script "npm run build" tiene metidos los comandos de migración/seed,
# usamos directo "npx nest build" aquí para que no intente duplicar tareas en el builder.
RUN npx nest build

# 2. Fase de producción
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./

# Instalamos solo las dependencias de producción
RUN npm ci --omit=dev

# Copiamos lo compilado y el esquema de Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Copiamos tu cliente de Prisma personalizado generado en src/
COPY --from=builder /app/src/generated ./src/generated

# Copiamos las herramientas de ejecución de Prisma que sí existen en node_modules
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma 
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

EXPOSE 3000

# Cuando el contenedor se encienda en Coolify, migra, inserta el seed y arranca
CMD ["sh", "-c", "echo $DATABASE_URL && npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]