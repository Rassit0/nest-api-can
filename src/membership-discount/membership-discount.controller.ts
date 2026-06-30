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
import { MembershipDiscountService } from './membership-discount.service';
import { CreateMembershipDiscountDto } from './dto/create-membership-discount.dto';
import { UpdateMembershipDiscountDto } from './dto/update-membership-discount.dto';
import { PlayerMembershipDiscountsPaginationDto } from './dto/pagination.dto';

@Controller('membership-discount')
export class MembershipDiscountController {
  constructor(
    private readonly membershipDiscountService: MembershipDiscountService,
  ) {}

  @Post()
  create(@Body() createMembershipDiscountDto: CreateMembershipDiscountDto) {
    return this.membershipDiscountService.create(createMembershipDiscountDto);
  }

  @Get()
  async findAll(
    @Query() paginationDto: PlayerMembershipDiscountsPaginationDto,
  ) {
    return await this.membershipDiscountService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.membershipDiscountService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMembershipDiscountDto: UpdateMembershipDiscountDto,
  ) {
    return await this.membershipDiscountService.update(
      id,
      updateMembershipDiscountDto,
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.membershipDiscountService.remove(id);
  }

  @Post(':id')
  async finish(@Param('id', ParseUUIDPipe) id: string) {
    return await this.membershipDiscountService.finish(id);
  }
}
