const path = require('path');

const ARTIFACT_ROOT_DIR = path.resolve(process.cwd(), 'uploads', 'runs');
const DRY_RUN_ARTIFACT_NAMESPACE = 'dry-run';
const FAILURE_SCREENSHOT_FILENAME = 'failure.png';
const FAILURE_SCREENSHOT_CONTENT_TYPE = 'image/png';

module.exports = {
  ARTIFACT_ROOT_DIR,
  DRY_RUN_ARTIFACT_NAMESPACE,
  FAILURE_SCREENSHOT_FILENAME,
  FAILURE_SCREENSHOT_CONTENT_TYPE,
};
