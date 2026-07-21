import { Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from './generated/prisma/client';
import { ClsService } from 'nestjs-cls';

// Tipos auxiliares para evitar el uso de 'any' y mantener el tipado estricto
type AuditableData = {
  createdById?: string;
  updatedById?: string;
};

type AuditableResult = {
  id?: string;
};

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(private readonly cls: ClsService) {
    // Configuramos el adaptador de PostgreSQL para Prisma
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });

    // Modelos que NO queremos auditar para evitar bucles infinitos o ruido en la BD
    const ignoreModels = ['AuditLog', 'User'];
    
    // Guardamos la referencia a la instancia original (PrismaClient)
    // porque dentro de la extensión '$extends', 'this' cambia de contexto.
    const self = this;

    // Creamos un cliente extendido que intercepta TODAS las operaciones de la base de datos
    const extended = this.$extends({
      query: {
        $allModels: {
          // Intercepta todas las creaciones (prisma.model.create)
          async create({ model, args, query }) {
            // 1. Obtenemos el ID del usuario logueado usando ClsService (Thread Local Storage)
            const userId = cls.get('userId') as string | undefined;
            
            // 2. Si hay usuario y estamos enviando datos, rellenamos quién lo creó y actualizó
            if (userId && args.data) {
              const data = args.data as AuditableData;
              if (data.createdById === undefined) data.createdById = userId;
              if (data.updatedById === undefined) data.updatedById = userId;
            }
            
            // 3. Ejecutamos la consulta real en la base de datos
            const result = await query(args);
            
            // 4. Si el modelo no está ignorado, creamos el log de auditoría
            if (!ignoreModels.includes(model)) {
              self.auditLog
                .create({
                  data: {
                    entityName: model, // Ej: "Player", "Course"
                    entityId: (result as AuditableResult)?.id || 'unknown',
                    action: 'CREATE',
                    newValues: result as Prisma.InputJsonValue, // Guardamos el registro completo que se creó
                    userId: userId || null,
                  },
                })
                .catch((e: unknown) => console.error('AuditLog error:', e)); // Evita que un error en auditoría rompa el flujo principal
            }
            return result;
          },

          // Intercepta todas las actualizaciones (prisma.model.update)
          async update({ model, args, query }) {
            const userId = cls.get('userId') as string | undefined;
            
            // 1. Inyectamos quién está actualizando el registro
            if (userId && args.data) {
              const data = args.data as AuditableData;
              if (data.updatedById === undefined) data.updatedById = userId;
            }

            // 2. Antes de actualizar, buscamos los valores antiguos para el log
            let oldValues: Prisma.InputJsonValue | undefined;
            if (!ignoreModels.includes(model)) {
              try {
                // Buscamos dinámicamente el modelo en la instancia de Prisma
                const delegate = self[model as keyof typeof self] as {
                  findUnique: (args: { where: unknown }) => Promise<unknown>;
                };
                if (delegate && typeof delegate.findUnique === 'function') {
                  oldValues = (await delegate.findUnique({
                    where: args.where, // Usamos la misma condición (where) del update
                  })) as Prisma.InputJsonValue;
                }
              } catch (e) {} // Ignoramos errores si no se encuentra
            }

            // 3. Ejecutamos la actualización
            const result = await query(args);

            // 4. Registramos el cambio en AuditLog (con valores viejos y nuevos)
            if (!ignoreModels.includes(model)) {
              self.auditLog
                .create({
                  data: {
                    entityName: model,
                    entityId: (result as AuditableResult)?.id || 'unknown',
                    action: 'UPDATE',
                    oldValues, // El estado anterior
                    newValues: result as Prisma.InputJsonValue, // El estado nuevo modificado
                    userId: userId || null,
                  },
                })
                .catch((e: unknown) => console.error('AuditLog error:', e));
            }
            return result;
          },

          // Intercepta todos los borrados (prisma.model.delete)
          async delete({ model, args, query }) {
            const userId = cls.get('userId') as string | undefined;
            
            // 1. Buscamos el registro ANTES de borrarlo para guardar qué fue lo que se eliminó
            let oldValues: Prisma.InputJsonValue | undefined;
            if (!ignoreModels.includes(model)) {
              try {
                const delegate = self[model as keyof typeof self] as {
                  findUnique: (args: { where: unknown }) => Promise<unknown>;
                };
                if (delegate && typeof delegate.findUnique === 'function') {
                  oldValues = (await delegate.findUnique({
                    where: args.where,
                  })) as Prisma.InputJsonValue;
                }
              } catch (e) {}
            }

            // 2. Ejecutamos el borrado
            const result = await query(args);

            // 3. Guardamos en el log de auditoría los datos del registro eliminado
            if (!ignoreModels.includes(model)) {
              self.auditLog
                .create({
                  data: {
                    entityName: model,
                    entityId: (result as AuditableResult)?.id || 'unknown',
                    action: 'DELETE',
                    oldValues, // Aquí guardamos qué contenía la fila que borramos
                    userId: userId || null,
                  },
                })
                .catch((e: unknown) => console.error('AuditLog error:', e));
            }
            return result;
          },

          // Intercepta los upserts (insertar si no existe, actualizar si existe)
          async upsert({ model, args, query }) {
            const userId = cls.get('userId') as string | undefined;
            
            // 1. Inyectamos los campos de auditoría tanto para la parte de create como de update
            if (userId) {
              if (args.create) {
                const createData = args.create as AuditableData;
                if (createData.createdById === undefined)
                  createData.createdById = userId;
                if (createData.updatedById === undefined)
                  createData.updatedById = userId;
              }
              if (args.update) {
                const updateData = args.update as AuditableData;
                if (updateData.updatedById === undefined)
                  updateData.updatedById = userId;
              }
            }
            
            // 2. Ejecutamos el upsert
            const result = await query(args);
            
            // 3. Registramos en el log
            if (!ignoreModels.includes(model)) {
              self.auditLog
                .create({
                  data: {
                    entityName: model,
                    entityId: (result as AuditableResult)?.id || 'unknown',
                    action: 'UPSERT',
                    newValues: result as Prisma.InputJsonValue,
                    userId: userId || null,
                  },
                })
                .catch((e: unknown) => console.error('AuditLog error:', e));
            }
            return result;
          },
        },
      },
    });

    // IMPORTANTE: Devolvemos el cliente extendido casteado a PrismaService.
    // Esto hace que cualquier servicio que inyecte PrismaService en su constructor,
    // reciba en realidad este proxy extendido que intercepta todo automáticamente.
    return extended as unknown as PrismaService;
  }
}
