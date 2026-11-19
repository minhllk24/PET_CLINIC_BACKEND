module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup.js'],
  testPathIgnorePatterns: ['/node_modules/', 'tests/e2e-appointment-slot-flow\\.test\\.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
};
