const express = require("express");
const app = express();
const PORT = 3000;

let isTestRunning = false;
let browser;

async function getBrowserInstance() {
  if (!browser) {
    const puppeteer = await import("puppeteer");
    browser = await puppeteer.launch({ headless: true, args: ['--remote-debugging-port=9222'] });
  }
  return browser;
}

app.get("/lcp", async (req, res) => {
  if (isTestRunning) {
    return res.status(429).json({ error: "A test is already running. Please try again later." });
  }

  const { url, cpuSlowdownMultiplier, downloadThroughput, uploadThroughput, latency, emulatedFormFactor } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  isTestRunning = true;

  try {
    const lighthouseModule = await import("lighthouse");
    const lighthouse = lighthouseModule.default || lighthouseModule;

    const browser = await getBrowserInstance();
    const page = await browser.newPage();
    await page.goto(url);

    const port = 9222; // Explicitly set the debugging port

    const throttling = {
      cpuSlowdownMultiplier: cpuSlowdownMultiplier ? parseFloat(cpuSlowdownMultiplier) : 1.2,
      downloadThroughput: downloadThroughput ? parseInt(downloadThroughput) : 4096 * 1024,
      uploadThroughput: uploadThroughput ? parseInt(uploadThroughput) : 1024 * 1024,
      latency: latency ? parseInt(latency) : 40,
    };

    const options = {
      logLevel: "silent",
      output: "json",
      port: port,
      throttlingMethod: "devtools",
      throttling, 
      onlyCategories: ["performance"],
      emulatedFormFactor: emulatedFormFactor ? emulatedFormFactor : "mobile",
    };

    // Run Lighthouse
    const { lhr } = await lighthouse(url, options);
    const lcp = lhr.audits["largest-contentful-paint"].numericValue / 1000;

    await page.close();

    res.json({ url, lcp });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    isTestRunning = false;
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
