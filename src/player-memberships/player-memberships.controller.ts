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
import { PlayerMembershipsService } from './player-memberships.service';
import { CreatePlayerMembershipDto } from './dto/create-player-membership.dto';
import { UpdatePlayerMembershipDto } from './dto/update-player-membership.dto';
import { PlayerMembershipsPaginationDto } from './dto/pagination.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@Controller('player-memberships')
export class PlayerMembershipsController {
  constructor(
    private readonly playerMembershipsService: PlayerMembershipsService,
  ) {}

  @Post()
  async create(@Body() createPlayerMembershipDto: CreatePlayerMembershipDto) {
    return await this.playerMembershipsService.create(
      createPlayerMembershipDto,
    );
  }

  @Get()
  async findAll(@Query() paginationDto: PlayerMembershipsPaginationDto) {
    return await this.playerMembershipsService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.playerMembershipsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePlayerMembershipDto: UpdatePlayerMembershipDto,
  ) {
    return await this.playerMembershipsService.update(
      id,
      updatePlayerMembershipDto,
    );
  }

  @Post('finish/:id')
  async finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.finish(
      id,
      changeStatusDto.reason,
    );
  }
  @Post('suspend/:id')
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.suspend(
      id,
      changeStatusDto.reason,
    );
  }
  @Post('withdraw/:id')
  async withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.withdraw(
      id,
      changeStatusDto.reason,
    );
  }
  @Post('reactivate/:id')
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changeStatusDto: ChangeStatusDto,
  ) {
    return await this.playerMembershipsService.reactivate(
      id,
      changeStatusDto.reason,
    );
  }
}
