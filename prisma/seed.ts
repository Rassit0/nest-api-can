import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'src/generated/prisma/client';

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
