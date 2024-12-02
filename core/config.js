const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  urls: {
    loginPage: 'https://portal.unimedpalmas.coop.br/',
    targetPage: 'https://portal.unimedpalmas.coop.br/wheb_gridDet.jsp',
  },
  paths: {
    outputFile: 'guiasFaturar.csv',
  },
  dataPositions: [1, 29, 2, 3, 17, 5, 16],
  retrySettings: {
    defaultTimeout: 10000,
    maxRetries: 3,
    delayBetweenRetries: 5000,
  },
};
