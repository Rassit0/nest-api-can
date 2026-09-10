import { Injectable, Logger } from '@nestjs/common';
import { IStorageProvider } from '../interfaces/storage-provider.interface';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { envs } from '../../config/envs';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = envs.s3.bucket!;
    
    this.s3Client = new S3Client({
      region: envs.s3.region,
      endpoint: envs.s3.endpoint, // Opcional, útil para Cloudflare R2 / MinIO
      credentials: {
        accessKeyId: envs.s3.accessKeyId!,
        secretAccessKey: envs.s3.secretAccessKey!,
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'attachments',
  ): Promise<{ url: string; path: string; internalName: string }> {
    const extension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${extension}`;
    const internalName = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: internalName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);

      return {
        url: this.getFileUrl(internalName),
        path: internalName,
        internalName: internalName,
      };
    } catch (error) {
      this.logger.error(`Error subiendo archivo a S3: ${internalName}`, error);
      throw error;
    }
  }

  async deleteFile(internalName: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: internalName,
    });

    try {
      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Error eliminando archivo de S3: ${internalName}`, error);
    }
  }

  getFileUrl(internalName: string): string {
    if (envs.s3.publicUrl) {
      const baseUrl = envs.s3.publicUrl.replace(/\/$/, '');
      return `${baseUrl}/${internalName}`;
    }

    if (envs.s3.endpoint) {
      const baseUrl = envs.s3.endpoint.replace(/\/$/, '');
      return `${baseUrl}/${this.bucket}/${internalName}`;
    }

    return `https://${this.bucket}.s3.${envs.s3.region}.amazonaws.com/${internalName}`;
  }
}
