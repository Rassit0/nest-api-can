const fs = require('fs');

const csFile = 'test/course-seasons.e2e-spec.ts';
let csContent = fs.readFileSync(csFile, 'utf8');

csContent = csContent.replace(
  /const result = await courseSeasonsService\.create\(createDto\);/g,
  "let result;\n      try {\n        result = await courseSeasonsService.create(createDto);\n      } catch(e) {\n        console.error('ERROR CREATING COURSE SEASON:', e);\n        throw e;\n      }"
);

fs.writeFileSync(csFile, csContent);

const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

transferContent = transferContent.replace(
  /const resultRegular = await courseSeasonsService\.create\(/g,
  "const resultRegular = await courseSeasonsService.create("
); // Just to verify we can wrap it if needed. For now let's wrap it.

transferContent = transferContent.replace(
  /const resultRegular = await courseSeasonsService\.create\(\{/g,
  "let resultRegular;\n      try {\n        resultRegular = await courseSeasonsService.create({\n"
);
transferContent = transferContent.replace(
  /recurringFee:\s*'100',\s*billingDay:\s*1,\s*debtToleranceMonths:\s*1,\s*lateFeeEnabled:\s*false,\s*registrationFee:\s*'10'\s*\}\s*\}\);/g,
  "recurringFee: '100', billingDay: 1, debtToleranceMonths: 1, lateFeeEnabled: false, registrationFee: '10' } });\n      } catch(e) {\n        console.error('ERROR CREATING REGULAR:', e);\n        throw e;\n      }"
);

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests 5');
