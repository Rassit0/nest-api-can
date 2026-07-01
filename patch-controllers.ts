import * as fs from 'fs';
import * as path from 'path';

function toPascalCase(str: string) {
  return str.split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

// Convert plural to singular manually for some cases
function toSingular(str: string) {
  if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
  if (str.endsWith('ses')) return str.slice(0, -2);
  if (str.endsWith('s') && !str.endsWith('ss')) return str.slice(0, -1);
  return str;
}

const controllersDir = path.join(__dirname, 'src');

function findControllers(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findControllers(filePath, fileList);
    } else if (file.endsWith('.controller.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const controllers = findControllers(controllersDir);

controllers.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const fileName = path.basename(filePath, '.controller.ts');
  if (fileName === 'app') return; // skip app.controller
  
  const singularName = toSingular(fileName);
  const dtoName = toPascalCase(singularName) + 'ResponseDto';
  
  // Calculate relative paths
  const relativeDepth = filePath.split(path.sep).length - path.join(__dirname, 'src').split(path.sep).length;
  let relativePath = '';
  for (let i = 0; i < relativeDepth - 1; i++) {
    relativePath += '../';
  }
  if (!relativePath) relativePath = './';
  
  const decoratorImportPath = relativePath + 'common/decorators/api-responses.decorator';
  const dtoImportPath = relativePath + 'common/dto/responses/entities.dto';
  
  // Add imports if not present
  if (!content.includes('ApiStandardResponse') && !content.includes('ApiPaginatedResponse')) {
    const importStatement = `import { ApiStandardResponse, ApiPaginatedResponse } from '${decoratorImportPath.replace(/\\/g, '/')}';\nimport { ${dtoName} } from '${dtoImportPath.replace(/\\/g, '/')}';\n`;
    
    // insert after last import
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf('\\n', lastImportIndex);
    
    if (lastImportIndex !== -1) {
      content = content.replace(/(import .*?['"];?\n)(?!import )/s, `$1${importStatement}`);
    } else {
      content = importStatement + content;
    }
  }

  // Very naive replacement for ApiOkResponse
  // Replace findAll
  content = content.replace(/@ApiOkResponse\(\{\s*description:\s*(['"`][^'"`]*['"`])(?:[\s\S]*?)\}\)\s*(?:async\s+)?findAll/g, 
    `@ApiPaginatedResponse(${dtoName}, $1)\n  async findAll`);
  
  content = content.replace(/@ApiOkResponse\(\{\s*description:\s*(['"`][^'"`]*['"`])\s*\}\)\s*(?:async\s+)?findAll/g, 
    `@ApiPaginatedResponse(${dtoName}, $1)\n  async findAll`);

  // Replace others
  content = content.replace(/@ApiOkResponse\(\{\s*description:\s*(['"`][^'"`]*['"`])(?:[\s\S]*?)\}\)\s*(?:async\s+)?(findOne|create|update|remove|updateStatus)/g, 
    `@ApiStandardResponse(${dtoName}, $1)\n  async $2`);

  content = content.replace(/@ApiOkResponse\(\{\s*description:\s*(['"`][^'"`]*['"`])\s*\}\)\s*(?:async\s+)?(findOne|create|update|remove|updateStatus)/g, 
    `@ApiStandardResponse(${dtoName}, $1)\n  async $2`);

  content = content.replace(/@ApiCreatedResponse\(\{\s*description:\s*(['"`][^'"`]*['"`])(?:[\s\S]*?)\}\)\s*(?:async\s+)?create/g, 
    `@ApiStandardCreatedResponse(${dtoName}, $1)\n  async create`);

  content = content.replace(/@ApiCreatedResponse\(\{\s*description:\s*(['"`][^'"`]*['"`])\s*\}\)\s*(?:async\s+)?create/g, 
    `@ApiStandardCreatedResponse(${dtoName}, $1)\n  async create`);

  // Add ApiStandardCreatedResponse to imports if needed
  if (content.includes('ApiStandardCreatedResponse') && !content.includes('ApiStandardCreatedResponse,')) {
    content = content.replace('ApiStandardResponse,', 'ApiStandardResponse, ApiStandardCreatedResponse,');
  }

  fs.writeFileSync(filePath, content, 'utf8');
});

console.log('Controladores actualizados exitosamente.');
