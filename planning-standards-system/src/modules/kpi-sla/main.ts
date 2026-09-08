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
    .setTitle('KPI & SLA Standards')
    .setDescription('PSS — KPI & SLA Standards API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('kpi-sla/api/docs', app, SwaggerModule.createDocument(app, config));

  app.getHttpAdapter().get('/', (req, res) => {
    res.redirect('/kpi-sla/api/docs');
  });

  const port = process.env.PORT ?? 4001;
  await app.listen(port, '0.0.0.0');
  console.log(`kpi-sla running → http://0.0.0.0:${port}`);
  console.log(`Swagger         → http://localhost:${port}/kpi-sla/api/docs`);
}
bootstrap();