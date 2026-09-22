import { Controller, Get, Put, Body, Param, ParseEnumPipe, UseGuards } from '@nestjs/common';
import { MatchCallUpsService } from './match-call-ups.service';
import { UpdateMatchCallUpBulkDto } from './dto/update-match-call-up-bulk.dto';
import { MatchSide } from 'src/generated/prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('api/matches')
export class MatchCallUpsController {
  constructor(private readonly matchCallUpsService: MatchCallUpsService) {}

  @RequirePermissions('READ_MATCHES')
  @Get(':matchId/call-ups')
  findAll(@Param('matchId') matchId: string) {
    return this.matchCallUpsService.findAllByMatch(matchId);
  }

  @RequirePermissions('READ_MATCHES')
  @Get(':matchId/call-ups/candidates')
  findCandidates(@Param('matchId') matchId: string) {
    return this.matchCallUpsService.findCandidates(matchId);
  }

  @RequirePermissions('UPDATE_MATCHES')
  @Put(':matchId/call-ups/:side')
  updateBulk(
    @Param('matchId') matchId: string,
    @Param('side', new ParseEnumPipe(MatchSide)) side: MatchSide,
    @Body() dto: UpdateMatchCallUpBulkDto,
  ) {
    return this.matchCallUpsService.updateBulk(matchId, side, dto);
  }
}
