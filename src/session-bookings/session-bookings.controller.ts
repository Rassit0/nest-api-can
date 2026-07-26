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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { SessionBookingsService } from './session-bookings.service';
import { CreateSessionBookingDto } from './dto/create-session-booking.dto';
import { UpdateSessionBookingDto } from './dto/update-session-booking.dto';
import { SessionBookingsPaginationDto } from './dto/pagination.dto';
import {
  ApiStandardResponse,
  ApiPaginatedResponse,
} from '../common/decorators/api-responses.decorator';
import { SessionBookingResponseDto } from '../common/dto/responses/entities.dto';
import { AuthGuard } from '@nestjs/passport';
import { UserRoleGuard } from '../auth/guards/user-role/user-role.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Session Bookings')
@Controller('session-bookings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), UserRoleGuard)
export class SessionBookingsController {
  constructor(
    private readonly sessionBookingsService: SessionBookingsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un jugador en un entrenamiento' })
  @RequirePermissions('CREATE_SESSION_BOOKINGS')
  async create(@Body() createSessionBookingDto: CreateSessionBookingDto) {
    return await this.sessionBookingsService.create(createSessionBookingDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de reservas/asistencias a entrenamientos',
  })
  @RequirePermissions('READ_SESSION_BOOKINGS')
  async findAll(@Query() paginationDto: SessionBookingsPaginationDto) {
    return await this.sessionBookingsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de una reserva de entrenamiento por ID',
  })
  @RequirePermissions('READ_SESSION_BOOKINGS')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionBookingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una reserva de entrenamiento específica',
  })
  @ApiBody({ type: UpdateSessionBookingDto })
  @RequirePermissions('UPDATE_SESSION_BOOKINGS')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSessionBookingDto: UpdateSessionBookingDto,
  ) {
    return await this.sessionBookingsService.update(
      id,
      updateSessionBookingDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una reserva de entrenamiento' })
  @RequirePermissions('DELETE_SESSION_BOOKINGS')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionBookingsService.remove(id);
  }
}
