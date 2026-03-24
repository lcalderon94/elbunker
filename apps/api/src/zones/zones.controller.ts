import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ZonesService } from './zones.service';

@ApiTags('Zones')
@Controller('zones')
export class ZonesController {
  constructor(private zonesService: ZonesService) {}

  @Get()
  @ApiOperation({ summary: 'List all active zones with tables' })
  findAll() {
    return this.zonesService.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get zone by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.zonesService.findBySlug(slug);
  }

  @Get(':slug/availability')
  @ApiOperation({ summary: 'Check availability for a zone on a specific date and hour' })
  @ApiQuery({ name: 'date', example: '2026-09-11' })
  @ApiQuery({ name: 'hour', example: '18:00' })
  @ApiQuery({ name: 'duration', required: false, type: Number, example: 2, description: 'Duration in hours (1-5)' })
  getAvailability(
    @Param('slug') slug: string,
    @Query('date') date: string,
    @Query('hour') hour: string,
    @Query('duration') duration?: string,
  ) {
    return this.zonesService.getAvailability(slug, date, hour, duration ? +duration : 2);
  }
}
