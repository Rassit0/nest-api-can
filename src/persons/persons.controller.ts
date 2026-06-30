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
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonPaginationDto } from './dto/pagination.dto';
import { FormDataRequest } from 'nestjs-form-data';
import { ApiConsumes } from '@nestjs/swagger';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  async create(@Body() createPersonDto: CreatePersonDto) {
    return await this.personsService.create(createPersonDto);
  }

  @Get()
  async findAll(@Query() paginationDto: PersonPaginationDto) {
    return await this.personsService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.personsService.findOne(id);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @FormDataRequest()
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePersonDto: UpdatePersonDto,
  ) {
    return await this.personsService.update(id, updatePersonDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.personsService.remove(id);
  }
}
