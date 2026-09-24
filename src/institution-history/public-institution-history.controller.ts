import { Controller, Get } from '@nestjs/common';
import { InstitutionHistoryService } from './institution-history.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Public')
@Controller('public/institution-history')
export class PublicInstitutionHistoryController {
  constructor(private readonly historyService: InstitutionHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener la historia institucional (Intro y Timeline activo)' })
  async getPublicHistory() {
    const [settings, items] = await Promise.all([
      this.historyService.getSettings(),
      this.historyService.getItems(true), // activeOnly = true
    ]);

    return {
      intro: {
        title: settings.title,
        description: settings.description,
        imageUrl: settings.imageUrl,
        imageAlt: settings.imageAlt,
      },
      timeline: items.map(item => ({
        id: item.id,
        year: item.year,
        title: item.title,
        description: item.description,
      })),
    };
  }
}
