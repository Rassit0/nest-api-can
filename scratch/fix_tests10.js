const fs = require('fs');
const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

transferContent = transferContent.replace(
  /regularAfternoonShiftId\s*=\s*resultTarde\.data\.id;/g,
  "regularAfternoonShiftId = (await prisma.courseSeasonShift.findFirst({ where: { courseSeasonId: regularSeasonId, shiftId: shiftAfternoon.id } })).id;"
);

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests 10');
