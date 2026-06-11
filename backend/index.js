require('dotenv').config();
const app = require('./src/app');
const { connectDatabase } = require('./src/config/db');
const { assertJwtConfig } = require('./src/config/jwtConfig');
const { assertAutomationConfig } = require('./src/utils/automationUrlPolicy');
const { reconcileOrphanedAutomationRuns } = require('./src/services/automation/automationRunReconciler');
const { runArtifactRetentionCleanup } = require('./src/services/automation/artifactRetentionService');

const port = Number(process.env.PORT || 5000);
const ARTIFACT_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function bootstrap() {
	assertJwtConfig();
	assertAutomationConfig();
	await connectDatabase();

	const reconcileSummary = await reconcileOrphanedAutomationRuns();
	if (reconcileSummary.resumed > 0 || reconcileSummary.finalized > 0) {
		console.log('[startup] Automation reconcile:', reconcileSummary);
	}

	await runArtifactRetentionCleanup();
	setInterval(() => {
		runArtifactRetentionCleanup().catch((error) => {
			console.error('[artifactRetention] Scheduled cleanup failed:', error);
		});
	}, ARTIFACT_RETENTION_INTERVAL_MS);

	app.listen(port, () => {
		console.log(`Server running on port ${port}`);
	});
}

bootstrap().catch((error) => {
	console.error('Failed to start server:', error);
	process.exit(1);
});