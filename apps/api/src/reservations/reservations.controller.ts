import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  SpecialRequestDto,
  CancelReservationDto,
} from './dto/reservation.dto';

@ApiTags('Reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private reservationsService: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a reservation' })
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  @Post('special-request')
  @ApiOperation({ summary: 'Submit a special request for large groups' })
  specialRequest(@Body() dto: SpecialRequestDto) {
    return this.reservationsService.createSpecialRequest(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get reservation details' })
  findById(@Param('id') id: string) {
    return this.reservationsService.findById(id);
  }

  @Delete(':cancelToken')
  @ApiOperation({ summary: 'Cancel a reservation using cancel token + email' })
  cancel(
    @Param('cancelToken') cancelToken: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancel(cancelToken, dto.email);
  }
}
