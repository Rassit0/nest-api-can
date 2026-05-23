import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivitiesPaginationDto } from './dto/pagination.dto';
import { ActivitiesSummaryPaginationDto } from './dto/pagination-summary.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  create(@Body() createActivityDto: CreateActivityDto) {
    return this.activitiesService.create(createActivityDto);
  }

  @Get()
  async findAll(@Query() paginationDto: ActivitiesPaginationDto) {
    return this.activitiesService.findAll(paginationDto);
  }

  @Get('summary')
  async getSummary(@Query() paginationDto: ActivitiesSummaryPaginationDto) {
    return await this.activitiesService.getSummary(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateActivityDto: UpdateActivityDto,
  ) {
    return await this.activitiesService.update(id, updateActivityDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.activitiesService.remove(id);
  }

  @Get('locations/options')
  async getLocationsOptions() {
    return this.activitiesService.getLocationsOptions();
  }
}
