import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  APP_TIMEZONE: string;
}

const envsSchema = joi
  .object({
    //Aqui se definen las variables de entorno que se van a usar
    PORT: joi.number().required(),
    DATABASE_URL: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    APP_TIMEZONE: joi.string().default('America/La_Paz'),
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
};
