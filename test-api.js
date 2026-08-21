const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const shift = await prisma.courseSeasonShift.findFirst({ select: { id: true } });
    if (shift) {
      console.log('Testing CourseSeasonShift endpoint with ID:', shift.id);
      const res = await fetch(`http://localhost:3000/reports/payments-matrix/course-season-shifts/${shift.id}`);
      const data = await res.json();
      console.log('CourseSeasonShift PASS. Response:', JSON.stringify(data).slice(0, 300) + '...');
    } else {
      console.log('No CourseSeasonShift found in DB to test.');
    }

    const teamSeason = await prisma.teamSeason.findFirst({ select: { id: true } });
    if (teamSeason) {
      console.log('Testing TeamSeason endpoint with ID:', teamSeason.id);
      const res2 = await fetch(`http://localhost:3000/reports/payments-matrix/team-seasons/${teamSeason.id}`);
      const data2 = await res2.json();
      console.log('TeamSeason PASS. Response:', JSON.stringify(data2).slice(0, 300) + '...');
    } else {
      console.log('No TeamSeason found in DB to test.');
    }
  } catch (error) {
    console.error('Error during endpoint test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
