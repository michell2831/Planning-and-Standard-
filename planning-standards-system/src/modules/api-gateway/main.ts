import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './src/app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    const rawAllowed = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL;
    const explicitOrigins = rawAllowed ? rawAllowed.split(',').map(o => o.trim()) : [];

    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (explicitOrigins.includes(origin)) return callback(null, true);
            if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
            if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
            // Default permissive for preview/staging
            callback(null, true);
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });

    const config = new DocumentBuilder()
        .setTitle('PSS API Gateway')
        .setDescription('Single entry point for the Planning Standards System — validates JWTs via ARMS and routes requests to PSS microservices')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

    app.getHttpAdapter().get('/', (req, res) => {
        res.redirect('/api/docs');
    });

    const port = process.env.PORT ?? 4003;
    await app.listen(port, '0.0.0.0');
    console.log(`PSS API Gateway running → http://0.0.0.0:${port}`);
    console.log(`Swagger                 → http://localhost:${port}/api/docs`);
}
bootstrap();