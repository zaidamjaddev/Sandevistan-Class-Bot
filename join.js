require('dotenv').config(); // Load variables from .env file
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const axios = require("axios");
const https = require("https");
const { spawnSync, execSync } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

puppeteer.use(StealthPlugin());

const URL = process.argv[2];
const STUDENT_NAME = process.env.STUDENT_NAME || "Student";
const NTFY_TOPIC = process.env.NTFY_TOPIC || "my_class_alerts";
const PLATFORM = os.platform(); 
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ipv4Agent = new https.Agent({ family: 4 });

// --- OS CONFIGURATION ---
let chromePath = "";
let liveProfile = "";

if (PLATFORM === 'win32') {
  chromePath = process.env.CHROME_PATH_WIN || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  liveProfile = path.join(os.homedir(), "AppData\\Local\\Google\\Chrome\\User Data");
} else if (PLATFORM === 'darwin') {
  chromePath = process.env.CHROME_PATH_MAC || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  liveProfile = path.join(os.homedir(), "Library/Application Support/Google/Chrome");
} else {
  chromePath = process.env.CHROME_PATH_LINUX || "/opt/google/chrome/google-chrome";
  liveProfile = path.join(os.homedir(), ".config/google-chrome");
}

const botProfile = path.join(__dirname, "sandevistan_profile");

(async () => {
  if (!URL) { console.error("No URL provided!"); process.exit(1); }

  console.log(`Sandevistan Activated for ${STUDENT_NAME} on ${PLATFORM}`);

  // Kill existing Chrome
  try {
    const killCmd = PLATFORM === 'win32' ? 'taskkill /F /IM chrome.exe /T' : 'pkill -f google-chrome';
    execSync(killCmd, { stdio: 'ignore' });
    await delay(2000);
  } catch (_) {}

  // Syncing Profile
  console.log("Preparing Profile...");
  if (PLATFORM !== 'win32') {
    spawnSync("rsync", ["-a", "--delete", "--exclude=Default/Cache/", `${liveProfile}/`, `${botProfile}/`]);
  } else {
    if (!fs.existsSync(botProfile)) fs.mkdirSync(botProfile, { recursive: true });
  }

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    protocolTimeout: 60000,
    defaultViewport: null,
    args: [
      `--user-data-dir=${botProfile}`,
      "--profile-directory=Default",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--start-maximized",
      PLATFORM === 'linux' ? "--display=:0" : ""
    ].filter(arg => arg !== ""),
  });

  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  page.on("dialog", async (d) => await d.dismiss());

  try {
    console.log(`🌐 Navigating to: ${URL}`);
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await delay(8000);

    let joined = false;

    // --- ZOOM LOGIC ---
    if (URL.includes("zoom.us")) {
      console.log("🔵 Zoom detected...");
      const zoomWebUrl = URL.includes("/wc/") ? URL : URL.replace("/j/", "/wc/join/");
      if (!URL.includes("/wc/")) await page.goto(zoomWebUrl, { waitUntil: "domcontentloaded" });
      
      await delay(5000);
      try {
        await page.waitForSelector('input[name="display_name"]', { timeout: 6000 });
        await page.click('input[name="display_name"]', { clickCount: 3 });
        await page.type('input[name="display_name"]', STUDENT_NAME);
        await page.click("#joinBtn");
        joined = true;
      } catch (_) { joined = true; }
    } 
    // --- GOOGLE MEET LOGIC ---
    else {
      console.log("Google Meet detected...");
      await delay(5000);

      const modifier = PLATFORM === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await page.keyboard.press('d');
      await page.keyboard.press('e');
      await page.keyboard.up(modifier);

      const joinSelectors = [
        'button[jsname="Qx7uuf"]', 
        'button[jsname="Hnmqjc"]', 
        'button[aria-label*="join"]'
      ];

      for (const sel of joinSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: 5000 });
          await page.click(sel);
          joined = true;
          break;
        } catch (_) {}
      }
    }

    if (joined) {
      console.log(`Joined as ${STUDENT_NAME}! Sending alarm to topic: ${NTFY_TOPIC}`);
      await axios.post(`https://ntfy.sh/${NTFY_TOPIC}`, `WAKE UP ${STUDENT_NAME}! Class joined: ${URL}`, {
        headers: { Title: "SANDEVISTAN ACTIVE", Priority: "5", Tags: "alarm_clock,rotating_light" },
        httpsAgent: ipv4Agent
      });
    }

    setInterval(async () => {
      try { await page.mouse.move(Math.random() * 500, Math.random() * 500); } catch (_) {}
    }, 60000);

  } catch (e) {
    console.error("Error:", e.message);
    await browser.close();
  }
})();