import { IsString, IsInt, IsEmail, IsOptional, IsArray, Min, Max, Matches, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReservationDto {
  @ApiProperty({ example: '2026-09-11' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Hour must be in HH:MM format' })
  hour: string;

  @ApiProperty({ example: 2, description: 'Duration in hours (1-5 Tue-Thu, 1-4 Fri-Sun)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  duration?: number;

  @ApiProperty({ example: 'principal' })
  @IsString()
  zoneSlug: string;

  @ApiProperty({ example: ['M4', 'M5'] })
  @IsArray()
  @IsString({ each: true })
  tableCodes: string[];

  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  @Max(20)
  people: number;

  @ApiProperty({ example: 'Juan García' })
  @IsString()
  customerName: string;

  @ApiProperty({ example: 'juan@email.com' })
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ example: '600123456' })
  @IsString()
  customerPhone: string;

  @ApiPropertyOptional({ example: 'cumpleanos' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SpecialRequestDto {
  @ApiProperty({ example: '2026-09-11' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '20:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hour: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  duration?: number;

  @ApiProperty({ example: 'principal' })
  @IsString()
  zoneSlug: string;

  @ApiProperty({ example: 14 })
  @IsInt()
  @Min(1)
  @Max(30)
  people: number;

  @ApiProperty({ example: 'Ana López' })
  @IsString()
  customerName: string;

  @ApiProperty({ example: 'ana@email.com' })
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ example: '600456789' })
  @IsString()
  customerPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiProperty({ example: 'Somos 14 amigos' })
  @IsString()
  notes: string;
}

export class CheckAvailabilityDto {
  @ApiProperty({ example: '2026-09-11' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  hour: string;

  @ApiProperty({ example: 'principal' })
  @IsString()
  zoneSlug: string;
}

export class CancelReservationDto {
  @ApiProperty({ example: 'juan@email.com' })
  @IsEmail()
  email: string;
}
