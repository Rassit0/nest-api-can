import { Injectable, Logger } from '@nestjs/common';
import { IStorageProvider } from '../interfaces/storage-provider.interface';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly baseUrl = process.env.APP_URL || 'http://localhost:3001';

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'attachments'): Promise<{ url: string; path: string; internalName: string }> {
    const targetFolder = path.join(this.uploadDir, folder);
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const extension = path.extname(file.originalname);
    const internalName = `${uuidv4()}${extension}`;
    const filePath = path.join(targetFolder, internalName);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      url: this.getFileUrl(`${folder}/${internalName}`),
      path: filePath,
      internalName,
    };
  }

  async deleteFile(internalName: string): Promise<void> {
    const filePath = path.join(this.uploadDir, internalName);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${internalName}`, error);
    }
  }

  getFileUrl(internalName: string): string {
    return `${this.baseUrl}/uploads/${internalName}`;
  }
}
