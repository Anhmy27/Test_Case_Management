require('dotenv').config();
const app = require('./src/app');
const { connectDatabase } = require('./src/config/db');

const port = Number(process.env.PORT || 5000);

async function bootstrap() {
	await connectDatabase();

	app.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});
}

bootstrap().catch((error) => {
	console.error('Failed to start server:', error);
	process.exit(1);
});