import { NestFactory } from "@nestjs/core"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"
import { NestExpressApplication } from "@nestjs/platform-express"
import { AppModule } from "./app.module"
import { join } from "path"
import "source-map-support/register"
import { INestMicroservice, ValidationPipe } from "@nestjs/common"
import { ExceptionsFilter } from "./exception.filter"
import { LoggingInterceptor } from "./logging.interceptor"
import { MicroserviceOptions, Transport } from "@nestjs/microservices"

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		logger: ["log", "error", "warn", "debug", "verbose"],
	})

	// Enable CORS for frontend communication
	app.enableCors({
		origin: [
			'http://localhost:8080', // Your frontend port
			'http://localhost:5173', // Vite dev server
			'http://localhost:3000', // Alternative dev server
			'http://127.0.0.1:8080',
			'http://127.0.0.1:5173',
			'http://127.0.0.1:3000',
		],
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-Vault-Token'],
		credentials: true,
	})

	app.useGlobalFilters(new ExceptionsFilter())
	app.useGlobalInterceptors(new LoggingInterceptor())
	app.setGlobalPrefix("v1")
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
		})
	)

	const options = new DocumentBuilder().setTitle("Wallet API").setDescription("Some fancy API").setVersion("0.0.1").addTag("Wallet").setVersion("v1").build()

	const walletDocs = SwaggerModule.createDocument(app, options, {
		include: [AppModule],
	})

	SwaggerModule.setup("docs", app, walletDocs)

	if (process.env.NODE_ENV === "development") {
		app.useStaticAssets(join(__dirname, "..", "documentation"))
	}

	await app.listen(8081)
}
bootstrap()
