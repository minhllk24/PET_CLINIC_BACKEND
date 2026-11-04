import fs from 'fs';
import os from 'os';
import path from 'path';

test('resolves the default OpenAPI spec independently of the working directory', () => {
  const previousDirectory = process.cwd();
  const previousSpec = process.env.OPENAPI_SPEC_PATH;
  try {
    delete process.env.OPENAPI_SPEC_PATH;
    process.chdir(os.tmpdir());
    jest.resetModules();
    const config = require('../src/shared/config').default;
    expect(config.openapiSpecPath).toBe(path.resolve(__dirname, '../docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml'));
    expect(fs.existsSync(config.openapiSpecPath)).toBe(true);
  } finally {
    process.chdir(previousDirectory);
    if (previousSpec === undefined) delete process.env.OPENAPI_SPEC_PATH;
    else process.env.OPENAPI_SPEC_PATH = previousSpec;
  }
});
