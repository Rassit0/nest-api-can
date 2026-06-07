import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';
import { ClubsPaginationDto } from './dto/pagination.dto';

@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Post()
  async create(@Body() createClubDto: CreateClubDto) {
    return await this.clubsService.create(createClubDto);
  }

  @Get()
  async findAll(@Query() paginationDto: ClubsPaginationDto) {
    return await this.clubsService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clubsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClubDto: UpdateClubDto,
  ) {
    return await this.clubsService.update(id, updateClubDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clubsService.remove(id);
  }

  @Get('all/options')
  async getClubsOptions() {
    return await this.clubsService.getClubsOptions();
  }

  @Get('disciplines/options')
  async getDisciplinesOptions() {
    return await this.clubsService.getDisciplinesOptions();
  }

  @Get('organizations/options')
  async getOrganizationsOptions() {
    return await this.clubsService.getOrganizationsOptions();
  }
}
