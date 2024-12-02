const { chromium } = require('playwright');
const { execSync } = require('child_process');
const { credentials, urls, retrySettings } = require('./config');
const { logMessage, retry } = require('./helper');

async function loginAuth() {
  let browser, page;

  const execute = async () => {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    page = await context.newPage();

    page.on('dialog', async (dialog) => {
      logMessage('cyan', `DIALOG: ${dialog.message()}`);
      await dialog.accept();
    });

    page.on('popup', async (popup) => {
      await popup.waitForLoadState();
      popup.close();
    });

    page.setDefaultTimeout(retrySettings.defaultTimeout);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(urls.loginPage, {
      waitUntil: 'domcontentloaded',
    });

    const frame = page
      .frameLocator('iframe >> nth=0')
      .frameLocator('#principal');

    await frame.locator('#tipoUsuario').selectOption('P');
    await frame.locator('#nmUsuario').click();
    await frame.locator('#nmUsuario').fill(credentials.login);
    await frame.locator('#dsSenha').click();
    await frame.locator('#dsSenha').fill(credentials.password);
    await frame.getByRole('button', { name: 'Entrar' }).click();
  };

  try {
    await retry(execute);
    console.clear();
    logMessage('green', 'USUÁRIO LOGADO!');
    return { page, browser };
  } catch (error) {
    logMessage('red', 'Falha ao processar dados do usuário: ' + error.message);

    try {
      execSync('npx playwright install', { stdio: 'inherit' });
      logMessage('yellow', 'Playwright dependencies installed. Retrying...');
      
      // Retry the login process after installation
      return await loginAuth();
    } catch (installError) {
      logMessage('red', 'Falha ao instalar dependências do Playwright: ' + installError.message);
      throw installError;
    }
  }
}

async function loginAndNavigate(executeFn) {
  const { page, browser } = await loginAuth();
  try {
    await retry(() => executeFn(page));
    console.clear();
    logMessage('green', 'REDIRECIONANDO! AGUARDE...');
    return { page, browser };
  } catch (error) {
    logMessage('yellow', `O REDIRECIONAMENTO FALHOU! ERRO: ${error.message}!`);
    await browser.close();
    throw error;
  }
}

module.exports = {
  loginAuth,
  loginAndNavigate,
};
