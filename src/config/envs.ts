import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  APP_TIMEZONE: string;
  STORAGE_DRIVER: string;
  S3_REGION?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET?: string;
  S3_PUBLIC_URL?: string;
}

const envsSchema = joi
  .object({
    // Aqui se definen las variables de entorno que se van a usar
    PORT: joi.number().required(),
    DATABASE_URL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    APP_TIMEZONE: joi.string().default('America/La_Paz'),
    STORAGE_DRIVER: joi.string().valid('local', 's3').default('local'),
    
    // Configuración condicional para S3
    S3_REGION: joi.string().when('STORAGE_DRIVER', {
      is: 's3',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    S3_ACCESS_KEY_ID: joi.string().when('STORAGE_DRIVER', {
      is: 's3',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    S3_SECRET_ACCESS_KEY: joi.string().when('STORAGE_DRIVER', {
      is: 's3',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    S3_BUCKET: joi.string().when('STORAGE_DRIVER', {
      is: 's3',
      then: joi.required(),
      otherwise: joi.optional(),
    }),
    
    S3_ENDPOINT: joi.string().optional(),
    S3_PUBLIC_URL: joi.string().optional(),
  })
  .unknown(true);

// Validacion de las variables de entorno
const { error, value } = envsSchema.validate(process.env);

// Si hay error al validar las variables de entorno, se lanza un error
if (error) {
  throw new Error(
    'Error al validar las variables de entorno: ' + error.message,
  );
}

// Se asignan las variables de entorno a la interfaz EnvVars
const envVars: EnvVars = value;

// Se exportan las variables de entorno
export const envs = {
  port: envVars.PORT,
  databaseUrl: envVars.DATABASE_URL,
  jwtSecret: envVars.JWT_SECRET,
  appTimezone: envVars.APP_TIMEZONE,
  
  // Storage
  storageDriver: envVars.STORAGE_DRIVER,
  s3: {
    region: envVars.S3_REGION,
    endpoint: envVars.S3_ENDPOINT,
    accessKeyId: envVars.S3_ACCESS_KEY_ID,
    secretAccessKey: envVars.S3_SECRET_ACCESS_KEY,
    bucket: envVars.S3_BUCKET,
    publicUrl: envVars.S3_PUBLIC_URL,
  }
};
