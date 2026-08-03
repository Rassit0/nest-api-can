export interface IStorageProvider {
  uploadFile(file: Express.Multer.File, folder?: string): Promise<{ url: string; path: string; internalName: string }>;
  deleteFile(internalName: string): Promise<void>;
  getFileUrl(internalName: string): string;
}
