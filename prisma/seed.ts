import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function main() {
  console.log('🌱 Seeding database...');

  let defaultOrganization = await prisma.institution.findFirst({
    where: {
      name: 'Club Atlético Nacional',
    },
  });

  if (!defaultOrganization) {
    defaultOrganization = await prisma.institution.create({
      data: {
        name: 'Club Atlético Nacional',
        address: 'Parque de la Unión Nacional, Oruro, Bolivia',
        latitude: -17.9657801,
        longitude: -67.1147712,
        googleMapsUrl: 'https://maps.app.goo.gl/h5McEVLB72ao7YN29',
        contacts: {
          create: [
            {
              department: 'Secretaría General',
              email: 'canoruro@gmail.com',
              phone: '+591 12345678',
              isDefault: true,
            },
            {
              department: 'Directorio',
              email: 'directorio@can.edu.bo',
              phone: '+591 87654321',
              isDefault: false,
            },
          ],
        },
      },
    });
  } else {
    // Si ya existe, nos aseguramos de actualizar sus datos de ubicación básicos
    defaultOrganization = await prisma.institution.update({
      where: { id: defaultOrganization.id },
      data: {
        address: 'Parque de la Unión Nacional, Oruro, Bolivia',
        latitude: -17.9657801,
        longitude: -67.1147712,
        googleMapsUrl:
          'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d1209.5224940861024!2d-67.1104421!3d-17.9621869!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x93e2b0a460cff053%3A0x61b01a9655349177!2sClub%20Atletico%20nacional%20CAN!5e1!3m2!1ses!2sbo!4v1784428198966!5m2!1ses!2sbo',
      },
    });

    // Verificamos si ya tiene contactos, de lo contrario los creamos (útil para bd existentes)
    const contactsCount = await prisma.institutionContact.count({
      where: { institutionId: defaultOrganization.id },
    });

    if (contactsCount === 0) {
      await prisma.institutionContact.createMany({
        data: [
          {
            institutionId: defaultOrganization.id,
            department: 'Secretaría General',
            email: 'canoruro@gmail.com',
            phone: '+591 12345678',
            isDefault: true,
          },
          {
            institutionId: defaultOrganization.id,
            department: 'Directorio',
            email: 'directorio@can.edu.bo',
            phone: '+591 87654321',
            isDefault: false,
          },
        ],
      });
    }
  }

  console.log('✅ Institution seeded:', defaultOrganization.name);

  console.log('🔒 Seeding permissions and roles...');
  const modules = [
    'INSTITUTIONS', 'LOCATIONS', 'DISCIPLINES', 'CATEGORIES', 'ROLES', 'PERMISSIONS',
    'USERS', 'PERSONS', 'CLUBS', 'TEAMS', 'PLAYERS', 'TEAM_SEASONS', 'STAFF',
    'TEAM_SEASON_STAFF', 'SEASONS', 'SCHOOLS', 'COURSES', 'COURSE_SEASONS',
    'COURSE_SEASON_STAFF', 'STUDENTS', 'PAYMENT_PLANS', 'MEMBERSHIPS',
    'STUDENT_MEMBERSHIPS', 'PLAYER_MEMBERSHIPS', 'MEMBERSHIP_DISCOUNTS',
    'MEMBERSHIP_CHARGES', 'STUDENT_CHARGES', 'TRANSACTIONS', 'SCHEDULES',
    'SESSIONS', 'SESSION_BOOKINGS', 'MATCHES', 'MATCH_LINEUPS',
    'SESSION_INCIDENTS', 'PROGRESS_EVALUATIONS', 'AUDIT_LOGS', 'DASHBOARD'
  ];

  const actions = ['CREATE', 'READ', 'UPDATE', 'DELETE'];

  const permissionsData: { name: string; module: string; description: string }[] = [];
  for (const module of modules) {
    for (const action of actions) {
      permissionsData.push({
        name: `${action}_${module}`,
        module,
        description: `Permiso para ${action.toLowerCase()} en el módulo de ${module.toLowerCase().replace(/_/g, ' ')}`,
      });
    }
  }

  // Agregamos un permiso adicional para MANAGE_ALL si es necesario o permisos extra
  permissionsData.push({
    name: 'MANAGE_ALL',
    module: 'SYSTEM',
    description: 'Acceso irrestricto a todo el sistema',
  });

  // 1. Creamos todos los permisos faltantes sin duplicar
  await prisma.permission.createMany({
    data: permissionsData,
    skipDuplicates: true,
  });

  // 2. Traemos todos los permisos
  const allPermissions = await prisma.permission.findMany();

  // 3. Upsert del rol SUPER_ADMIN
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: { description: 'Administrador con acceso total al sistema' },
    create: {
      name: 'SUPER_ADMIN',
      description: 'Administrador con acceso total al sistema',
    },
  });

  // 4. Asignamos todos los permisos al rol SUPER_ADMIN
  const rolePermissionsData = allPermissions.map((p) => ({
    roleId: superAdminRole.id,
    permissionId: p.id,
  }));

  await prisma.rolePermission.createMany({
    data: rolePermissionsData,
    skipDuplicates: true,
  });

  console.log(`✅ SUPER_ADMIN role seeded with ${allPermissions.length} permissions`);

  // 5. Upsert del usuario Super Admin
  const adminEmail = 'admin@can.edu.bo';
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: superAdminRole.id,
      // No actualizamos la contraseña si ya existe, para no pisar la del usuario real si la cambió
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      roleId: superAdminRole.id,
    },
  });

  console.log(`✅ Super Admin user seeded: ${superAdminUser.email}`);

  // 6. Rellenar los campos de auditoría (created_by_id y updated_by_id) vacíos en toda la base de datos
  console.log('🔄 Backfilling auditing fields for existing records...');
  
  const tablesWithCreatedBy = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'created_by_id' AND table_schema = 'public'
  `;

  for (const row of tablesWithCreatedBy) {
    const tableName = row.table_name;
    await prisma.$executeRawUnsafe(`UPDATE "${tableName}" SET "created_by_id" = $1 WHERE "created_by_id" IS NULL`, superAdminUser.id);
  }

  const tablesWithUpdatedBy = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_by_id' AND table_schema = 'public'
  `;

  for (const row of tablesWithUpdatedBy) {
    const tableName = row.table_name;
    await prisma.$executeRawUnsafe(`UPDATE "${tableName}" SET "updated_by_id" = $1 WHERE "updated_by_id" IS NULL`, superAdminUser.id);
  }

  console.log('✅ Auditing fields backfill completed successfully');
}
main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
