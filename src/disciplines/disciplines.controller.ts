import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DisciplinesService } from './disciplines.service';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';
import { DisciplinePaginationDto } from './dto/pagination.dto';

@Controller('disciplines')
export class DisciplinesController {
  constructor(private readonly disciplinesService: DisciplinesService) {}

  @Post()
  async create(@Body() createDisciplineDto: CreateDisciplineDto) {
    return await this.disciplinesService.create(createDisciplineDto);
  }

  @Get()
  async findAll(@Query() paginationDto: DisciplinePaginationDto) {
    return await this.disciplinesService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.disciplinesService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDisciplineDto: UpdateDisciplineDto,
  ) {
    return this.disciplinesService.update(id, updateDisciplineDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.disciplinesService.remove(id);
  }
}
