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
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SessionBookingsService } from './session-bookings.service';
import { CreateSessionBookingDto } from './dto/create-session-booking.dto';
import { UpdateSessionBookingDto } from './dto/update-session-booking.dto';
import { SessionBookingsPaginationDto } from './dto/pagination.dto';

@ApiTags('Session Bookings')
@Controller('session-bookings')
export class SessionBookingsController {
  constructor(
    private readonly sessionBookingsService: SessionBookingsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un jugador en un entrenamiento' })
  async create(@Body() createSessionBookingDto: CreateSessionBookingDto) {
    return await this.sessionBookingsService.create(createSessionBookingDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener lista de reservas/asistencias a entrenamientos',
  })
  async findAll(@Query() paginationDto: SessionBookingsPaginationDto) {
    return await this.sessionBookingsService.findAll(paginationDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de una reserva de entrenamiento por ID',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionBookingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una reserva de entrenamiento específica',
  })
  @ApiBody({ type: UpdateSessionBookingDto })
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
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.sessionBookingsService.remove(id);
  }
}
