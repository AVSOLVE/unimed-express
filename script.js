const { chromium } = require('playwright');

async function getPageTitle(url) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const title = await page.title();
    await browser.close();
    return title;
}

module.exports = { getPageTitle };
