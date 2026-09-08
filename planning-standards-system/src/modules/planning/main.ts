import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('Planning Service')
    .setDescription('PSS — Planning Hub & OPCR Tracker Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('planning/api/docs', app, SwaggerModule.createDocument(app, config));

  app.getHttpAdapter().get('/', (req, res) => {
    res.redirect('/planning/api/docs');
  });

  const port = process.env.PORT ?? 4005;
  await app.listen(port);
  console.log(`planning running → http://localhost:${port}`);
  console.log(`Swagger         → http://localhost:${port}/planning/api/docs`);
}
bootstrap();
