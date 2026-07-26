import { Project } from 'ts-morph';
import { AllSystemPermissions } from './src/common/config/permissions.config';

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const sourceFiles = project.getSourceFiles('src/**/*.controller.ts');

const invalidPermissions = new Set<string>();

for (const sourceFile of sourceFiles) {
  const classes = sourceFile.getClasses();
  const controllerClass = classes.find(c => c.getDecorator('Controller') !== undefined);
  if (!controllerClass) continue;

  const methods = controllerClass.getMethods();
  for (const method of methods) {
    const permDec = method.getDecorator('RequirePermissions');
    if (permDec) {
      const args = permDec.getArguments();
      args.forEach(arg => {
        const text = arg.getText().replace(/['"]/g, '');
        if (!AllSystemPermissions.includes(text)) {
          invalidPermissions.add(text);
          console.log(`Invalid permission found: ${text} in ${sourceFile.getBaseName()}`);
        }
      });
    }
  }
}

if (invalidPermissions.size === 0) {
  console.log('All permissions are valid!');
} else {
  console.log('Found invalid permissions:', Array.from(invalidPermissions));
}
