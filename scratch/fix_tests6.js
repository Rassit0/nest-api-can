const fs = require('fs');

const csFile = 'test/course-seasons.e2e-spec.ts';
let csContent = fs.readFileSync(csFile, 'utf8');

csContent = csContent.replace(/registrationFee:\s*'10'/g, "registrationFee: '10', chargeGenerationDaysBefore: 7");

fs.writeFileSync(csFile, csContent);

const transferFile = 'test/transfer-integration.e2e-spec.ts';
let transferContent = fs.readFileSync(transferFile, 'utf8');

transferContent = transferContent.replace(/registrationFee:\s*'10'/g, "registrationFee: '10', chargeGenerationDaysBefore: 7");

fs.writeFileSync(transferFile, transferContent);
console.log('Fixed tests 6');
