import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { PersonsModule } from './persons/persons.module';
import { DisciplinesModule } from './disciplines/disciplines.module';
import { CategoriesModule } from './categories/categories.module';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import path, { join } from 'path';

@Module({
  imports: [
    CommonModule,
    PersonsModule,
    DisciplinesModule,
    CategoriesModule,
    I18nModule.forRootAsync({
      useFactory: () => ({
        fallbackLanguage: 'es',
        loaderOptions: {
          path: join(process.cwd(), 'src/i18n'),
          watch: true,
        },
        typesOutputPath: join(__dirname, '../src/i18n/i18n.generated.ts'),
      }),
      resolvers: [new HeaderResolver(['x-custom-lang'])],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
