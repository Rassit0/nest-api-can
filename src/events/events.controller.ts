import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { EventQueriesService } from './event-queries.service';
import { CreateGeneralEventDto } from './dto/create-general-event.dto';
import { UpdateGeneralEventDto } from './dto/update-general-event.dto';
import { EventFilterDto } from './dto/event-filter.dto';
import { PreviewSeriesDto } from './dto/preview-series.dto';
import { EventMaterializationService } from './event-materialization.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from 'src/auth/guards/user-role/user-role.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Events (Global & General Events)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly queriesService: EventQueriesService,
    private readonly materializationService: EventMaterializationService,
  ) {}

  @Post('general')
  @ApiOperation({ summary: 'Create a new General Event' })
  @RequirePermissions('CREATE_EVENTS')
  async createGeneralEvent(
    @Body() createDto: CreateGeneralEventDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return await this.eventsService.createGeneralEvent(createDto, userId);
  }

  @Post('series/preview')
  @ApiOperation({ summary: 'Preview serie materialization (dry run)' })
  @RequirePermissions('CREATE_EVENTS')
  async previewSeries(@Body() previewDto: PreviewSeriesDto) {
    return await this.materializationService.previewSeries({
      startDate: previewDto.startDate,
      endDate: previewDto.endDate,
      locationId: previewDto.locationId,
      recurrenceRule: previewDto.recurrenceRule,
      timezone: previewDto.timezone,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Find global events based on filters' })
  @RequirePermissions('READ_EVENTS')
  async findAll(@Query() filter: EventFilterDto) {
    return await this.queriesService.findAll(filter);
  }

  @Get('general/:id')
  @ApiOperation({ summary: 'Find a specific general event by ID' })
  @RequirePermissions('READ_EVENTS')
  async findOneGeneralEvent(@Param('id') id: string) {
    return await this.queriesService.findOneGeneralEvent(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find a specific global event by ID' })
  @RequirePermissions('READ_EVENTS')
  async findOneEvent(@Param('id') id: string) {
    return await this.queriesService.findOneEvent(id);
  }

  @Patch('general/:id')
  @ApiOperation({ summary: 'Update a General Event' })
  @RequirePermissions('UPDATE_EVENTS')
  async updateGeneralEvent(
    @Param('id') id: string,
    @Body() updateDto: UpdateGeneralEventDto,
    @Req() req: any,
    @Query('scope') scope: 'single' | 'following' | 'all' = 'single',
  ) {
    const userId = req.user?.id;
    return await this.eventsService.updateGeneralEvent(id, updateDto, userId, scope);
  }

  @Delete('general/:id')
  @ApiOperation({ summary: 'Delete a General Event' })
  @RequirePermissions('DELETE_EVENTS')
  async removeGeneralEvent(
    @Param('id') id: string,
    @Query('scope') scope: 'single' | 'following' | 'all' = 'single',
  ) {
    return await this.eventsService.deleteGeneralEvent(id, scope);
  }
}
