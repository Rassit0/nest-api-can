import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const courseSeasons = await prisma.courseSeason.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      course: {
        include: { school: true, discipline: true }
      },
      shifts: {
        include: {
          shift: true
        }
      }
    }
  });

  const validCourse = courseSeasons.find(cs => cs.shifts.length > 1);
  if (validCourse) {
    console.log(`Found CourseSeason! ID: ${validCourse.id}`);
    console.log(`URL: http://localhost:3000/admin/courses/${validCourse.course.disciplineId}/${validCourse.course.schoolId}/${validCourse.courseId}/course-seasons/${validCourse.id}/student-memberships`);
    console.log(`Shifts: ${validCourse.shifts.map(s => s.shift.name).join(', ')}`);
  } else {
    console.log("No CourseSeason with multiple shifts found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
