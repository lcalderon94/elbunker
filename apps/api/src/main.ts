import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Validation pipe (like Bean Validation in Spring)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Strip unknown properties
      forbidNonWhitelisted: true, // Throw if unknown properties
      transform: true,           // Auto-transform types
    }),
  );

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('El Búnker API')
    .setDescription('API del Board Game Café El Búnker')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🎲 El Búnker API running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
