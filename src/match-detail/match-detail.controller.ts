import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MatchDetailService } from './match-detail.service';
import { CreateMatchDetailDto } from './dto/create-match-detail.dto';
import { UpdateMatchDetailDto } from './dto/update-match-detail.dto';

@Controller('match-detail')
export class MatchDetailController {
  constructor(private readonly matchDetailService: MatchDetailService) {}

  @Post()
  create(@Body() createMatchDetailDto: CreateMatchDetailDto) {
    return this.matchDetailService.create(createMatchDetailDto);
  }

  @Get()
  findAll() {
    return this.matchDetailService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.matchDetailService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMatchDetailDto: UpdateMatchDetailDto) {
    return this.matchDetailService.update(+id, updateMatchDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.matchDetailService.remove(+id);
  }
}
