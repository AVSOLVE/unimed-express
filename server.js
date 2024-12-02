const express = require('express');
const app = express();
const session = require('express-session');
const WebSocket = require('ws');
const cookieParser = require('cookie-parser');
const { retry, getPrincipalFrame } = require('./core/helper');
let globalWebSocket = null;
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const { urls, retrySettings } = require('./core/config');
const clients = new Set();
const wss = new WebSocket.Server({ port: 3000 });

function logMessage(color, message) {
  const formattedMessage = `${color}: ${JSON.stringify(message)}`;
  console.log(formattedMessage);

  // Send the log message via WebSocket if a connection exists
  if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
    globalWebSocket.send(JSON.stringify(message));
  }
}

async function loginAuth(credentials) {
  let browser, page;

  const execute = async () => {
    browser = await chromium.launch({ headless: true });
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
    await frame.locator('#nmUsuario').fill(credentials.username);
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
      return await loginAuth(credentials);
    } catch (installError) {
      logMessage(
        'red',
        'Falha ao instalar dependências do Playwright: ' + installError.message
      );
      throw installError;
    }
  }
}

async function loginAndNavigate(executeFn, credentials) {
  const { page, browser } = await loginAuth(credentials);
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

app.use(cookieParser());
app.use(
  session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(express.json());
wss.on('connection', (ws, request) => {
  console.log('New WebSocket client connected');
  globalWebSocket = ws;
  clients.add(ws);
  ws.messageQueue = []; // Queue for this client
  ws.isProcessing = false; // Lock to indicate processing status

  ws.on('message', async (message) => {
    try {
      // Add the new message to the queue
      ws.messageQueue.push(message);

      // Process the queue if not already processing
      if (!ws.isProcessing) {
        await processQueue(ws);
      }
    } catch (error) {
      console.error('Error queuing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (globalWebSocket === ws) {
      globalWebSocket = null; // Clear the global reference if this was the active connection
    }
    clients.delete(ws)
  });
});

async function processQueue(ws) {
  ws.isProcessing = true;

  while (ws.messageQueue.length > 0) {
    const currentMessage = ws.messageQueue.shift();

    try {
      const data = JSON.parse(currentMessage);
      await handleMessage(ws, data); // Process the message
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  ws.isProcessing = false; // Unlock when queue is empty
}

async function handleMessage(ws, data) {
  if (data.action === 'authenticate') {
    const token = data.token;
    if (isValidSession(token)) {
      console.log('Authentication successful');
      ws.send('Authenticated');
    } else {
      console.log('Invalid session');
      ws.send('Authentication failed');
      ws.close();
    }
  } else {
    await magicWorks(data);
  }
}

const server = app.listen(3300, () => {
  console.log('Server listening on port 3000');
});

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  // Check if session is valid before upgrading the connection
  if (request.session && request.session.user) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request); // Emit connection event after upgrade
    });
  } else {
    socket.destroy(); // Deny upgrade if not authenticated
  }
});

// Simulate session validation
function isValidSession(token) {
  // In a real application, this would check the session or a database
  return token === 'valid_token'; // Replace with actual validation logic
}

// Simple route to simulate login and set a session
app.post('/login', (req, res) => {
  const { username } = req.body;
  if (username) {
    req.session.user = username;
    res.status(200).send({ message: 'User logged in successfully' });
  } else {
    res.status(400).send({ message: 'Username is required' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

async function procuraGuia(frame, codigoBeneficiario, nomeBeneficiario) {
  try {
    await frame.locator('#CD_USUARIO_PLANO').type(codigoBeneficiario);
    const codigoBenef = await frame.locator('#CD_USUARIO_PLANO').inputValue();

    if ((codigoBenef && codigoBenef !== codigoBeneficiario) || !codigoBenef) {
      await frame.locator('#CD_USUARIO_PLANO').clear();
      await frame.locator('#CD_USUARIO_PLANO').type(codigoBeneficiario);
    }

    await frame.locator('#CD_USUARIO_PLANO').press('Tab');

    nomeBeneficiario = await frame.locator('#NM_SEGURADO').inputValue();
    if (!nomeBeneficiario) {
      throw new Error('Beneficiário não encontrado!');
    } else {
      await frame.getByRole('button', { name: 'Consultar' }).click();
      let validadeGuia = await frame.getByRole('cell').nth(19).innerText();
      let req = await frame.getByRole('cell').nth(23).innerText();
      let qtdAp = await frame.getByRole('cell').nth(29).innerText();
      let qtdRes = await frame.getByRole('cell').nth(31).innerText();
      let qtdGuia = await frame
        .getByRole('cell', { name: 'Procedimento' })
        .count();

      if (qtdGuia > 1) {
        logMessage('red', `QTD DE GUIAS: ${qtdGuia} \nVERIFIQUE!`);
      }

      logMessage(
        'white',
        `*******************************************************\n`
      ) +
        logMessage('white', `REQUISIÇÃO ${req} \nQTD APROVADA: ${qtdAp} `) +
        logMessage('yellow', `\nQTD RESTANTE: ${qtdRes - 1} `);

      await frame.locator('input[type="checkbox"]').first().click();
      return true;
    }
  } catch (error) {
    logMessage(
      'white',
      `${nomeBeneficiario.toUpperCase()} ==> SEM GUIAS PARA EXECUTAR!`
    );

    return false;
  }
}

async function executeNavigation(page) {
  const frame = page
    .frameLocator('iframe >> nth=0')
    .frameLocator('#principal')
    .frameLocator('td iframe')
    .frameLocator('frame >> nth=0');
  await frame.getByText('Execução da requisição').click();
  await frame.getByText('» Executar requisição').click();
}

async function magicWorks(data) {
  const { clients, credentials } = data;
  logMessage('green', 'Iniciando processamento de guias...', data);
  try {
    const { page, browser } = await loginAndNavigate(
      executeNavigation,
      credentials
    );

    for (const client of clients) {
      const { name, id_card, type, qtd } = client;
      if (id_card.trim().length === 17) {
        logMessage(
          'green',
          `Executando GUIA: ${id_card} -  ${name.toUpperCase()}`
        );

        const frame = await getPrincipalFrame(page);

        if ((await procuraGuia(frame, id_card, '***')) === false) {
          await frame.getByRole('button', { name: 'Nova consulta' }).click();
          logMessage('white', 'PRÓXIMO! AGUARDE...');
          continue;
        } else {
          await frame.getByRole('button', { name: 'Gerar guia' }).click();
          await frame.locator('select').selectOption(type);
          await frame.locator('input[type="text"]').fill(qtd);
          await frame
            .getByRole('button', { name: 'Confirmar geração de guias' })
            .click();
          await frame.getByRole('button', { name: 'Voltar' }).click();
        }
      } else {
        logMessage('yellow', `Invalid code: ${id_card}`);
      }
    }
    await browser.close();
  } catch (error) {
    logMessage('red', 'Error processing guide codes:', error);
  }
}
