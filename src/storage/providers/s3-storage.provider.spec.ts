import { S3StorageProvider } from './s3-storage.provider';
import { envs } from '../../config/envs';

jest.mock('uuid', () => ({
  v4: () => '12345-uuid',
}));

jest.mock('../../config/envs', () => ({
  envs: {
    s3: {
      bucket: 'gestion-can',
      region: 'us-east-1',
      endpoint: '',
      publicUrl: '',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  },
}));

describe('S3StorageProvider - getFileUrl', () => {
  let provider: S3StorageProvider;

  beforeEach(() => {
    // Restaurar envs a un estado base
    envs.s3.bucket = 'gestion-can';
    envs.s3.publicUrl = '';
    envs.s3.endpoint = '';
    
    provider = new S3StorageProvider();
  });

  it('debería retornar la URL con el bucket en el path usando el comodín {bucket}', () => {
    envs.s3.publicUrl = 'https://storage.test/{bucket}';
    const internalName = 'avatars/test.webp';
    const url = provider.getFileUrl(internalName);
    
    expect(url).toBe('https://storage.test/gestion-can/avatars/test.webp');
  });

  it('debería retornar la URL directa si no requiere bucket (direct root)', () => {
    envs.s3.publicUrl = 'https://cdn.test';
    const internalName = 'avatars/test.webp';
    const url = provider.getFileUrl(internalName);
    
    expect(url).toBe('https://cdn.test/avatars/test.webp');
  });

  it('debería retornar la URL con el bucket en el hostname si se usa en el subdominio', () => {
    envs.s3.publicUrl = 'https://{bucket}.storage.test';
    const internalName = 'avatars/test.webp';
    const url = provider.getFileUrl(internalName);
    
    expect(url).toBe('https://gestion-can.storage.test/avatars/test.webp');
  });

  it('debería procesar correctamente los trailing slashes en publicUrl y en el internalName', () => {
    envs.s3.publicUrl = 'https://storage.test/{bucket}/';
    const internalName = '/avatars/test.webp'; // con un slash inicial
    const url = provider.getFileUrl(internalName);
    
    expect(url).toBe('https://storage.test/gestion-can/avatars/test.webp');
  });

  it('debería funcionar con nested keys', () => {
    envs.s3.publicUrl = 'https://storage.test/{bucket}';
    const internalName = 'web/banners/2026/home.webp';
    const url = provider.getFileUrl(internalName);
    
    expect(url).toBe('https://storage.test/gestion-can/web/banners/2026/home.webp');
  });

  it('debería retornar el fallback si publicUrl no está configurado (endpoint local/s3 genérico)', () => {
    envs.s3.endpoint = 'https://s3.local.test';
    const internalName = 'avatars/test.webp';
    const url = provider.getFileUrl(internalName);
    
    // El comportamiento heredado es que incluye el bucket en el path
    expect(url).toBe('https://s3.local.test/gestion-can/avatars/test.webp');
  });
  
  it('debería persistir correctamente la URL devuelta (Test de persistencia simulado)', async () => {
    // Simular el mock de upload
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test.webp',
      encoding: '7bit',
      mimetype: 'image/webp',
      size: 1024,
      destination: '',
      filename: '',
      path: '',
      buffer: Buffer.from([]),
      stream: null as any,
    };
    
    // Mock the send method to prevent actual upload
    jest.spyOn((provider as any).s3Client, 'send').mockResolvedValue(true as any);
    envs.s3.publicUrl = 'https://storage.test/{bucket}';
    
    const result = await provider.uploadFile(mockFile, 'avatars');
    
    // Comprobamos que el internalName se generó correctamente
    expect(result.internalName).toMatch(/^avatars\/[a-z0-9-]+\.webp$/);
    
    // El bug es que la url persistida estaría mal. Comprobamos la url.
    expect(result.url).toBe(`https://storage.test/gestion-can/${result.internalName}`);
  });
});
