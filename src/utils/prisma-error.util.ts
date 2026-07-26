import { Prisma } from 'src/generated/prisma/client';

export class PrismaErrorUtils {
  /**
   * Verifica si el error arrojado por Prisma corresponde a una violación de
   * restricción de unicidad (Unique Constraint). Generalmente esto ocurre en
   * código P2002.
   *
   * @param error Error capturado en bloque catch
   */
  static isUniqueConstraintViolation(error: any): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
