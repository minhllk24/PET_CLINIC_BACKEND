module.exports = {
  testEnvironment: 'node',
  setupFiles: ['./tests/setup.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
};
