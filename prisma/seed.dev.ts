import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { seedStructuralData } from './seed';

/**
 * Fixtures exclusivas para entornos de desarrollo y pruebas locales.
 *
 * NUNCA debe ser importado ni ejecutado por el flujo productivo (seed:prod).
 */
export async function seedDevFixtures(prisma: PrismaClient) {
  console.log('🔧 Starting development demo fixtures seed...');

  // 1. Obtener rol PROFESOR asegurando que la estructura esté presente
  const profesorRole = await prisma.role.findUnique({
    where: { name: 'PROFESOR' },
  });

  if (!profesorRole) {
    throw new Error(
      'Role PROFESOR no encontrado. Ejecuta primero el seed estructural.',
    );
  }

  // 2. Upsert de Person para el profesor de prueba
  const teacherEmail = 'profesor@can.edu.bo';
  let teacherPerson = await prisma.person.findFirst({
    where: { email: teacherEmail },
  });

  if (!teacherPerson) {
    teacherPerson = await prisma.person.create({
      data: {
        name: 'Profesor',
        lastName: 'Docente CAN',
        email: teacherEmail,
        phone: '+591 71111111',
      },
    });
    console.log(`✅ Demo Person created: ${teacherPerson.email}`);
  }

  // 3. Upsert del usuario profesor de prueba
  const rawPassword = process.env.DEV_TEACHER_PASSWORD || 'profesor123';
  const teacherHashedPassword = await bcrypt.hash(rawPassword, 10);

  const teacherUser = await prisma.user.upsert({
    where: { email: teacherEmail },
    update: {
      roleId: profesorRole.id,
      personId: teacherPerson.id,
    },
    create: {
      email: teacherEmail,
      password: teacherHashedPassword,
      roleId: profesorRole.id,
      personId: teacherPerson.id,
    },
  });
  console.log(`✅ Demo teacher user upserted: ${teacherUser.email}`);

  // 4. Asegurar registro Staff activo para el profesor de prueba
  let teacherStaff = await prisma.staff.findUnique({
    where: { personId: teacherPerson.id },
  });

  if (!teacherStaff) {
    teacherStaff = await prisma.staff.create({
      data: {
        personId: teacherPerson.id,
        isActive: true,
      },
    });
    console.log(`✅ Demo teacher Staff created: ${teacherStaff.id}`);
  } else if (!teacherStaff.isActive) {
    teacherStaff = await prisma.staff.update({
      where: { id: teacherStaff.id },
      data: { isActive: true },
    });
    console.log(`✅ Demo teacher Staff activated: ${teacherStaff.id}`);
  }

  // 5. Vincular Staff del profesor a grupos de prueba locales si existen
  const firstCourseShift = await prisma.courseSeasonShift.findFirst();
  if (firstCourseShift) {
    const existingCourseAssign = await prisma.courseSeasonStaff.findFirst({
      where: {
        staffId: teacherStaff.id,
        courseSeasonShiftId: firstCourseShift.id,
      },
    });
    if (!existingCourseAssign) {
      await prisma.courseSeasonStaff.create({
        data: {
          staffId: teacherStaff.id,
          courseSeasonShiftId: firstCourseShift.id,
          role: 'HEAD_COACH',
          isPrimary: true,
          startedAt: new Date('2024-01-01'),
        },
      });
      console.log(
        `✅ Demo Staff assigned to CourseSeasonShift: ${firstCourseShift.id}`,
      );
    }
  }

  const firstTeamCategory = await prisma.teamSeasonCategory.findFirst();
  if (firstTeamCategory) {
    const existingTeamAssign = await prisma.teamSeasonStaff.findFirst({
      where: {
        staffId: teacherStaff.id,
        teamSeasonCategoryId: firstTeamCategory.id,
      },
    });
    if (!existingTeamAssign) {
      await prisma.teamSeasonStaff.create({
        data: {
          staffId: teacherStaff.id,
          teamSeasonCategoryId: firstTeamCategory.id,
          role: 'HEAD_COACH',
          isPrimary: true,
          startedAt: new Date('2024-01-01'),
        },
      });
      console.log(
        `✅ Demo Staff assigned to TeamSeasonCategory: ${firstTeamCategory.id}`,
      );
    }
  }

  console.log('✅ Development demo fixtures completed.');
}

export async function main() {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Starting full development seed (structural + fixtures)...');
  try {
    // 1. Ejecutar primero el seed estructural limpio
    await seedStructuralData(prisma);
    // 2. Ejecutar fixtures de desarrollo
    await seedDevFixtures(prisma);
    console.log('✅ Full development seed completed successfully.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ Error executing development seed:', e);
    process.exit(1);
  });
}
