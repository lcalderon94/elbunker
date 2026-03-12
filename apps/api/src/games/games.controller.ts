import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GamesService } from './games.service';

@ApiTags('Games')
@Controller('games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'List games with filters and pagination' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'typeId', required: false, type: Number })
  @ApiQuery({ name: 'players', required: false, type: Number })
  @ApiQuery({ name: 'maxDifficulty', required: false, type: Number })
  @ApiQuery({ name: 'maxDuration', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('typeId') typeId?: string,
    @Query('players') players?: string,
    @Query('maxDifficulty') maxDifficulty?: string,
    @Query('maxDuration') maxDuration?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gamesService.findAll({
      search,
      typeId: typeId ? +typeId : undefined,
      players: players ? +players : undefined,
      maxDifficulty: maxDifficulty ? +maxDifficulty : undefined,
      maxDuration: maxDuration ? +maxDuration : undefined,
      page: page ? +page : 1,
      limit: limit ? +limit : 24,
    });
  }

  @Get('types')
  @ApiOperation({ summary: 'List all game types' })
  getTypes() {
    return this.gamesService.getTypes();
  }

  @Get('categories')
  @ApiOperation({ summary: 'List all game categories' })
  getCategories() {
    return this.gamesService.getCategories();
  }

  @Get('mechanics')
  @ApiOperation({ summary: 'List all game mechanics' })
  getMechanics() {
    return this.gamesService.getMechanics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get game details by ID' })
  findById(@Param('id') id: string) {
    return this.gamesService.findById(id);
  }
}
