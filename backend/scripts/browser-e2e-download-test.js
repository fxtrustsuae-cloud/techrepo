const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_API = process.env.BACKEND_API || 'http://localhost:5000/api';
const DOWNLOAD_DIR = path.join(__dirname, '..', 'reports', 'browser-download-test');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function findChromePath() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chrome.exe',
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Chromium executable not found');
}

async function waitForNewPdf(beforeSet, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    const added = files.find(f => !beforeSet.has(f));
    if (added) {
      const full = path.join(DOWNLOAD_DIR, added);
      const size1 = fs.statSync(full).size;
      await new Promise(r => setTimeout(r, 500));
      const size2 = fs.statSync(full).size;
      if (size2 > 0 && size2 >= size1) {
        return { name: added, size: size2 };
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Timed out waiting for downloaded PDF');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function currentPdfSet() {
  return new Set(fs.readdirSync(DOWNLOAD_DIR).filter(f => f.toLowerCase().endsWith('.pdf')));
}

async function capturePdfDownloadResponse(page, triggerClick, timeoutMs = 45000) {
  const responsePromise = page.waitForResponse((resp) => {
    const url = resp.url();
    const headers = resp.headers();
    const contentType = (headers['content-type'] || '').toLowerCase();
    return url.includes('/api/reports/') && url.includes('/download') && resp.status() === 200 && contentType.includes('application/pdf');
  }, { timeout: timeoutMs });

  await triggerClick();
  const response = await responsePromise;
  const bytes = await response.buffer();
  const headers = response.headers();

  if (!bytes.length) {
    throw new Error('Captured download response but PDF body is empty');
  }

  return {
    url: response.url(),
    status: response.status(),
    contentType: headers['content-type'] || '',
    contentDisposition: headers['content-disposition'] || '',
    size: bytes.length,
  };
}

async function waitForCompletedReport(page, timeoutMs = 240000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hasCompleted = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('table.data-table tbody span.badge'));
      return badges.some(b => (b.textContent || '').trim().toLowerCase() === 'completed');
    });

    if (hasCompleted) return true;
    await sleep(5000);
    await page.reload({ waitUntil: 'networkidle2' });
  }
  return false;
}

async function clickCompletedRowDownload(page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table.data-table tbody tr'));
    for (const row of rows) {
      const badges = Array.from(row.querySelectorAll('span.badge'));
      const completed = badges.some(b => (b.textContent || '').trim().toLowerCase() === 'completed');
      if (completed) {
        const btn = row.querySelector('button.btn-secondary');
        if (btn) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  });
}

async function waitForDashboardDownloadButton(page, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exists = await page.$('button[aria-label^="Download "]');
    if (exists) return true;
    await sleep(3000);
    await page.reload({ waitUntil: 'networkidle2' });
  }
  return false;
}

async function waitForReportsDownloadButton(page, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exists = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table.data-table tbody tr'));
      for (const row of rows) {
        const completed = Array.from(row.querySelectorAll('span.badge'))
          .some(b => (b.textContent || '').trim().toLowerCase() === 'completed');
        if (!completed) continue;
        if (row.querySelector('button.btn-secondary')) return true;
      }
      return false;
    });

    if (exists) return true;
    await sleep(3000);
    await page.reload({ waitUntil: 'networkidle2' });
  }
  return false;
}

(async () => {
  ensureDir(DOWNLOAD_DIR);

  const executablePath = findChromePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();
  await cdp.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR,
  });

  try {
    const ts = Date.now();
    const email = `browsertest+${ts}@example.com`;
    const password = 'Test123!@#';
    const registerRes = await fetch(`${BACKEND_API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        firstName: 'Browser',
        lastName: 'Test',
        companyName: 'Browser Test Co',
      }),
    });
    if (!registerRes.ok) {
      throw new Error(`Register API failed: ${registerRes.status}`);
    }
    const registerData = await registerRes.json();
    const token = registerData.token;
    if (!token) throw new Error('Register API did not return token');

    const generateRes = await fetch(`${BACKEND_API}/reports/generate-sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!generateRes.ok) {
      throw new Error(`Generate API failed: ${generateRes.status}`);
    }
    await generateRes.json();

    await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
    await page.evaluate((authToken) => {
      localStorage.setItem('token', authToken);
    }, token);

    await page.goto(`${FRONTEND_URL}/reports`, { waitUntil: 'networkidle2' });
    const reportsHasDownload = await waitForReportsDownloadButton(page, 90000);
    if (!reportsHasDownload) throw new Error('Reports download button not found for completed report');

    const reportDownload = await capturePdfDownloadResponse(
      page,
      async () => {
        const clickedReportsDownload = await clickCompletedRowDownload(page);
        if (!clickedReportsDownload) throw new Error('Could not click completed-row download button in Reports');
      },
      45000
    );

    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: 'networkidle2' });
    const dashboardHasDownload = await waitForDashboardDownloadButton(page, 60000);
    if (!dashboardHasDownload) throw new Error('Dashboard download button not found for completed report');

    const dashboardDownload = await capturePdfDownloadResponse(
      page,
      async () => {
        await page.click('button[aria-label^="Download "]');
      },
      45000
    );

    console.log(JSON.stringify({
      ok: true,
      frontend: FRONTEND_URL,
      email,
      downloadsDir: DOWNLOAD_DIR,
      reportsDownload: reportDownload,
      dashboardDownload,
    }, null, 2));
  } catch (err) {
    console.error('BROWSER_TEST_FAILED');
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
