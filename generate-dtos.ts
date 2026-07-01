import * as fs from 'fs';
import * as path from 'path';

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

const models = schemaContent.match(/model \w+ {[\s\S]*?}/g) || [];

let dtosContent = `import { ApiProperty } from '@nestjs/swagger';\n\n`;

models.forEach((modelText) => {
  const modelNameMatch = modelText.match(/model (\w+) {/);
  if (!modelNameMatch) return;
  const modelName = modelNameMatch[1];
  
  dtosContent += `export class ${modelName}ResponseDto {\n`;
  
  const lines = modelText.split('\n').slice(1, -1);
  lines.forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('//') || line.startsWith('@@')) return;
    
    // basic parsing
    const parts = line.split(/\s+/);
    if (parts.length < 2) return;
    
    const fieldName = parts[0];
    let fieldType = parts[1];
    
    let isOptional = false;
    let isArray = false;
    
    if (fieldType.endsWith('?')) {
      isOptional = true;
      fieldType = fieldType.slice(0, -1);
    } else if (fieldType.endsWith('[]')) {
      isArray = true;
      fieldType = fieldType.slice(0, -2);
    }
    
    let tsType = 'string';
    let apiExample = `'example_string'`;
    let apiType = '';
    
    switch (fieldType) {
      case 'String':
        tsType = 'string';
        apiExample = `'string'`;
        break;
      case 'Int':
      case 'Float':
        tsType = 'number';
        apiExample = `1`;
        break;
      case 'Boolean':
        tsType = 'boolean';
        apiExample = `true`;
        break;
      case 'DateTime':
        tsType = 'Date';
        apiExample = `'2024-01-01T00:00:00Z'`;
        break;
      default:
        // Enums or relations
        tsType = 'any';
        apiExample = `'any'`;
        break;
    }
    
    dtosContent += `  @ApiProperty({\n`;
    if (isOptional) dtosContent += `    required: false,\n`;
    if (isArray) dtosContent += `    isArray: true,\n`;
    dtosContent += `    example: ${apiExample},\n`;
    dtosContent += `  })\n`;
    dtosContent += `  ${fieldName}${isOptional ? '?' : ''}: ${tsType}${isArray ? '[]' : ''};\n\n`;
  });
  
  dtosContent += `}\n\n`;
});

const outDir = path.join(__dirname, 'src', 'common', 'dto', 'responses');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
fs.writeFileSync(path.join(outDir, 'entities.dto.ts'), dtosContent);
console.log('DTOs generados exitosamente en src/common/dto/responses/entities.dto.ts');
