import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ParseEnumPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MatchLineupsService } from './match-lineups.service';
import { UpdateMatchLineupBulkDto } from './dto/update-match-lineup-bulk.dto';
import { MatchSide } from 'src/generated/prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Match Lineups')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
@Controller('api/matches')
export class MatchLineupsController {
  constructor(private readonly matchLineupsService: MatchLineupsService) {}

  @Get(':matchId/lineup')
  @ApiOperation({ summary: 'Obtener planilla del partido' })
  @RequirePermissions('READ_MATCHES')
  getMatchLineup(@Param('matchId') matchId: string) {
    return this.matchLineupsService.getMatchLineup(matchId);
  }

  @Put(':matchId/lineup/:side')
  @ApiOperation({ summary: 'Actualizar participación y estadísticas por equipo' })
  @RequirePermissions('UPDATE_MATCHES')
  updateMatchLineupSide(
    @Param('matchId') matchId: string,
    @Param('side', new ParseEnumPipe(MatchSide)) side: MatchSide,
    @Body() dto: UpdateMatchLineupBulkDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.matchLineupsService.updateMatchLineupSide(matchId, side, dto, userId);
  }
}
