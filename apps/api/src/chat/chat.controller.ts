import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ChatMessageDto {
  @ApiProperty({ example: '¿Qué juegos tenéis para 4 personas?' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Conversation history for context' })
  @IsOptional()
  @IsArray()
  history?: Array<{ role: string; content: string }>;
}

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to Dexter chatbot' })
  chat(@Body() dto: ChatMessageDto) {
    return this.chatService.chat(dto.message, dto.history || []);
  }
}
