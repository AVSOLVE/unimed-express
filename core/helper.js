const logColors = require('ansi-colors');
const { retrySettings } = require('./config');

module.exports = {
  logMessage: (level, message) => {
    const colorFunctions = {
      black: logColors.bgBlack,
      red: logColors.bgRed,
      green: logColors.bgGreen,
      yellow: logColors.bgYellow,
      blue: logColors.bgBlue,
      magenta: logColors.bgMagenta,
      cyan: logColors.bgCyan,
      white: logColors.bgWhite,
    };
    const colorFunction = colorFunctions[level] || logColors.white;
    console.log(colorFunction(message));
  },

  getElapsedTime: (startTime) => {
    const timeInSeconds = Math.floor((new Date() - startTime) / 1000);
    if (timeInSeconds < 60) {
      return timeInSeconds + ' segundo' + (timeInSeconds !== 1 ? 's' : '');
    } else {
      const minutes = Math.floor(timeInSeconds / 60);
      const remainingSeconds = Math.floor(timeInSeconds % 60);

      if (remainingSeconds === 0) {
        return minutes + ' minuto' + (minutes !== 1 ? 's' : '');
      } else {
        return (
          minutes +
          ' minuto' +
          (minutes !== 1 ? 's' : '') +
          ' e ' +
          remainingSeconds +
          ' segundo' +
          (remainingSeconds !== 1 ? 's' : '')
        );
      }
    }
  },

  formatElapsedTime: (elapsedTime) => {
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(seconds).padStart(2, '0')}`;
  },

  isAMonthOlder: (dateString) => {
    const [day, month, year] = dateString
      .split(';')[2]
      .split(' ')[0]
      .split('/');
    const inputDate = new Date(`${year}-${month}-${day}`);
    const today = new Date();
    const diffInDays = Math.floor((today - inputDate) / (1000 * 60 * 60 * 24));
    return diffInDays >= 32;
  },

  retry: async (fn) => {
    const retries = retrySettings.maxRetries;
    const delay = retrySettings.delayBetweenRetries;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt < retries) {
          module.exports.logMessage(
            'yellow',
            `Tentativa ${attempt} falhou. Nova tentativa em ${delay / 1000}s...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          module.exports.logMessage(
            'red',
            `Todas as ${retries} tentativas falharam.`
          );
          throw error;
        }
      }
    }
  },

  getNthFrame: async (page) => {
    return page
      .frameLocator('iframe >> nth=0')
      .frameLocator('#principal')
      .frameLocator('td iframe')
      .frameLocator('frame >> nth=0');
  },

  getPrincipalFrame: async (page) => {
    return page
      .frameLocator('iframe >> nth=0')
      .frameLocator('#principal')
      .frameLocator('td iframe')
      .frameLocator('#paginaPrincipal');
  },

  matchCode: async (code) => {
    if (code.toString().length !== 8) {
      return null;
    }

    const codeMap = {
      20103131: '24,00',
      20103220: '8,09',
      20103344: '12,64',
      20103484: '6,72',
      20103492: '12,00',
      20103506: '6,72',
      20103514: '12,00',
      20103522: '25,28',
      20103646: '156,48',
      20103662: '11,38',
      50000144: '30,36',
      50000160: '12,64',
    };

    return codeMap[code] || null;
  },
};
