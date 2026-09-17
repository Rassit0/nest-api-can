import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export interface ImageProcessingOptions {
  aspectRatio?: '16:9' | '1:1' | '3:4' | '4:3';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);
  
  // Constantes de configuración
  private readonly MAX_WIDTH = 1920;
  private readonly WEBP_QUALITY = 80;
  
  // Lista de formatos soportados. Coincide con lo que Multer ya filtró (jpg, jpeg, png, webp).
  private readonly SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  /**
   * Procesa la imagen, redimensionando, aplicando crop opcional y convirtiendo a WebP.
   * Retorna el archivo modificado o lanza una excepción si el procesamiento falla.
   * Si el archivo no es una imagen soportada, lo devuelve intacto.
   */
  async processImage(file: Express.Multer.File, options?: ImageProcessingOptions): Promise<Express.Multer.File> {
    if (!this.SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      // Si no es una imagen soportada (ej. pdf o un mime raro), la dejamos pasar sin tocar.
      // La validación estricta ya ocurrió en el Controller/Multer.
      return file;
    }

    try {
      this.logger.log(`Iniciando optimización de imagen original: ${(file.size / 1024).toFixed(2)} KB`);

      const image = sharp(file.buffer).rotate(); // Normaliza la orientación basándose en EXIF
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('No se pudieron leer las dimensiones de la imagen.');
      }

      // IMPORTANTE: Si la imagen tiene orientación EXIF >= 5, Sharp invertirá el ancho y alto
      // al aplicar .rotate(). Debemos calcular las proporciones sobre las dimensiones finales.
      const isRotated = metadata.orientation && metadata.orientation >= 5;
      const originalWidth = isRotated ? metadata.height : metadata.width;
      const originalHeight = isRotated ? metadata.width : metadata.height;

      if (options?.aspectRatio) {
        // Mapear aspectRatio a valor numérico
        let targetRatio = 1;
        if (options.aspectRatio === '16:9') targetRatio = 16 / 9;
        if (options.aspectRatio === '4:3') targetRatio = 4 / 3;
        if (options.aspectRatio === '3:4') targetRatio = 3 / 4;

        // Calcular dimensiones exactas para el crop sin agrandar la imagen
        let cropWidth = originalWidth;
        let cropHeight = originalHeight;
        const originalRatio = originalWidth / originalHeight;

        if (originalRatio > targetRatio) {
          // La imagen es más ancha de lo que necesitamos -> recortar ancho
          cropWidth = Math.round(originalHeight * targetRatio);
        } else if (originalRatio < targetRatio) {
          // La imagen es más alta de lo que necesitamos -> recortar alto
          cropHeight = Math.round(originalWidth / targetRatio);
        }

        // Aplicar límite máximo de ancho sin perder la proporción
        if (cropWidth > this.MAX_WIDTH) {
          const scale = this.MAX_WIDTH / cropWidth;
          cropWidth = this.MAX_WIDTH;
          cropHeight = Math.round(cropHeight * scale);
        }

        // Determinar posición del crop (cover)
        // Sharp utiliza estas constantes como strings: 'center', 'top', 'bottom', 'left', 'right'
        // El tipado de sharp position coincide con nuestras opciones excepto que 'center' es 'centre' o 'attention', 
        // pero sharp acepta 'center' también. Por seguridad, mapearemos a las constantes de sharp:
        let positionMapping: number | string = sharp.strategy.attention; // Default inteligente o centro
        if (options.position === 'center') positionMapping = sharp.gravity.center;
        else if (options.position === 'top') positionMapping = sharp.gravity.north;
        else if (options.position === 'bottom') positionMapping = sharp.gravity.south;
        else if (options.position === 'left') positionMapping = sharp.gravity.west;
        else if (options.position === 'right') positionMapping = sharp.gravity.east;
        else positionMapping = sharp.gravity.center; // Default explícito a center si viene vacío

        image.resize({
          width: cropWidth,
          height: cropHeight,
          fit: 'cover',
          position: positionMapping,
        });
      } else {
        // Flujo original sin opciones (sin crop destructivo)
        image.resize({ width: this.MAX_WIDTH, withoutEnlargement: true });
      }

      // Convertir a WebP
      const processedBuffer = await image
        .webp({ quality: this.WEBP_QUALITY })
        .toBuffer();

      // Clonamos el objeto original para evitar mutaciones directas inesperadas si el mismo multer file se rehúsa
      const processedFile = { ...file };
      
      processedFile.buffer = processedBuffer;
      processedFile.mimetype = 'image/webp';
      processedFile.size = processedBuffer.length;
      
      // Aseguramos que la extensión sea .webp
      processedFile.originalname = processedFile.originalname.replace(/\.[^/.]+$/, "") + ".webp";

      this.logger.log(`Imagen optimizada a WebP correctamente. Nuevo tamaño: ${(processedFile.size / 1024).toFixed(2)} KB`);

      return processedFile;
    } catch (error) {
      this.logger.error(`Error procesando la imagen ${file.originalname}:`, error);
      throw new BadRequestException('Error al procesar y optimizar la imagen. Asegúrese de que el archivo de imagen es válido y no está corrupto.');
    }
  }
}
