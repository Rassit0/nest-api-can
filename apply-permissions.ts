import { Project, SyntaxKind, ClassDeclaration, ImportDeclaration, ImportSpecifier } from 'ts-morph';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const sourceFiles = project.getSourceFiles('src/**/*.controller.ts');

const EXCLUDED_CONTROLLERS = ['auth.controller.ts', 'app.controller.ts'];

const SPECIAL_MODULE_MAP: Record<string, string> = {
  // Add any manual mapping overrides here if needed
};

function getRelativePath(fromFile: string, toFile: string) {
  let relative = path.relative(path.dirname(fromFile), toFile);
  relative = relative.replace(/\\/g, '/');
  if (!relative.startsWith('.')) {
    relative = './' + relative;
  }
  if (relative.endsWith('.ts')) {
    relative = relative.slice(0, -3);
  }
  return relative;
}

for (const sourceFile of sourceFiles) {
  const fileName = sourceFile.getBaseName();
  if (EXCLUDED_CONTROLLERS.includes(fileName)) {
    console.log(`Skipping ${fileName}`);
    continue;
  }

  const baseName = fileName.replace('.controller.ts', '');
  const moduleName = SPECIAL_MODULE_MAP[baseName] || baseName.replace(/-/g, '_').toUpperCase();

  const classes = sourceFile.getClasses();
  const controllerClass = classes.find((c: ClassDeclaration) => c.getDecorator('Controller') !== undefined);

  if (!controllerClass) {
    console.log(`No @Controller class found in ${fileName}, skipping.`);
    continue;
  }

  // Handle Imports
  // 1. @nestjs/common -> UseGuards
  let commonImport = sourceFile.getImportDeclaration((decl: ImportDeclaration) => decl.getModuleSpecifierValue() === '@nestjs/common');
  if (commonImport) {
    if (!commonImport.getNamedImports().some((ni: ImportSpecifier) => ni.getName() === 'UseGuards')) {
      commonImport.addNamedImport('UseGuards');
    }
  } else {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@nestjs/common',
      namedImports: ['UseGuards']
    });
  }

  // 2. @nestjs/passport -> AuthGuard
  let passportImport = sourceFile.getImportDeclaration((decl: ImportDeclaration) => decl.getModuleSpecifierValue() === '@nestjs/passport');
  if (passportImport) {
    if (!passportImport.getNamedImports().some((ni: ImportSpecifier) => ni.getName() === 'AuthGuard')) {
      passportImport.addNamedImport('AuthGuard');
    }
  } else {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@nestjs/passport',
      namedImports: ['AuthGuard']
    });
  }

  // 3. @nestjs/swagger -> ApiBearerAuth
  let swaggerImport = sourceFile.getImportDeclaration((decl: ImportDeclaration) => decl.getModuleSpecifierValue() === '@nestjs/swagger');
  if (swaggerImport) {
    if (!swaggerImport.getNamedImports().some((ni: ImportSpecifier) => ni.getName() === 'ApiBearerAuth')) {
      swaggerImport.addNamedImport('ApiBearerAuth');
    }
  } else {
    // some files might not have swagger at all
  }

  // 4. UserRoleGuard
  const userRoleGuardPath = path.resolve('src/auth/guards/user-role/user-role.guard.ts');
  const userRoleGuardRel = getRelativePath(sourceFile.getFilePath(), userRoleGuardPath);
  let guardImport = sourceFile.getImportDeclaration((decl: ImportDeclaration) => decl.getModuleSpecifierValue() === userRoleGuardRel);
  if (!guardImport) {
    const existingGuard = sourceFile.getImportDeclarations().find((d: ImportDeclaration) => d.getNamedImports().some((ni: ImportSpecifier) => ni.getName() === 'UserRoleGuard'));
    if (!existingGuard) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: userRoleGuardRel,
        namedImports: ['UserRoleGuard']
      });
    }
  }

  // 5. RequirePermissions
  const reqPermsPath = path.resolve('src/auth/decorators/permissions.decorator.ts');
  const reqPermsRel = getRelativePath(sourceFile.getFilePath(), reqPermsPath);
  let permImport = sourceFile.getImportDeclaration((decl: ImportDeclaration) => decl.getModuleSpecifierValue() === reqPermsRel);
  if (!permImport) {
    const existingPerm = sourceFile.getImportDeclarations().find((d: ImportDeclaration) => d.getNamedImports().some((ni: ImportSpecifier) => ni.getName() === 'RequirePermissions'));
    if (!existingPerm) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: reqPermsRel,
        namedImports: ['RequirePermissions']
      });
    }
  }

  // Add Class Decorators
  if (!controllerClass.getDecorator('ApiBearerAuth')) {
    controllerClass.addDecorator({ name: 'ApiBearerAuth', arguments: [] });
  }

  if (!controllerClass.getDecorator('UseGuards')) {
    controllerClass.addDecorator({ name: 'UseGuards', arguments: ["AuthGuard('jwt')", "UserRoleGuard"] });
  } else {
    const useGuards = controllerClass.getDecorator('UseGuards');
    const args = useGuards!.getArguments().map((a: any) => a.getText());
    if (!args.includes("AuthGuard('jwt')")) {
      useGuards!.addArgument("AuthGuard('jwt')");
    }
    if (!args.includes("UserRoleGuard")) {
      useGuards!.addArgument("UserRoleGuard");
    }
  }

  // Add Method Decorators
  const methods = controllerClass.getMethods();
  for (const method of methods) {
    const isGet = method.getDecorator('Get') !== undefined;
    const isPost = method.getDecorator('Post') !== undefined;
    const isPatch = method.getDecorator('Patch') !== undefined;
    const isPut = method.getDecorator('Put') !== undefined;
    const isDelete = method.getDecorator('Delete') !== undefined;

    let action = '';
    if (isPost) action = 'CREATE';
    else if (isGet) action = 'READ';
    else if (isPatch || isPut) action = 'UPDATE';
    else if (isDelete) action = 'DELETE';

    if (action) {
      const permissionString = `'${action}_${moduleName}'`;
      if (!method.getDecorator('RequirePermissions')) {
        method.addDecorator({
          name: 'RequirePermissions',
          arguments: [permissionString]
        });
        console.log(`  Added ${permissionString} to ${method.getName()}`);
      }
    }
  }

  console.log(`Processed ${fileName} for module ${moduleName}`);
}

project.saveSync();
console.log('Done!');
