const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const axios = require("axios");
const https = require("https");
const { spawnSync } = require("child_process");

// Force IPv4 — Node 18+ prefers IPv6 by default which times out if IPv6 has no route
const ipv4Agent = new https.Agent({ family: 4 });

const LIVE_PROFILE = "/home/zaid/.config/google-chrome";
const BOT_PROFILE = "/home/zaid/.config/google-chrome-bot";

puppeteer.use(StealthPlugin());

const url = process.argv[2];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  if (!url) {
    console.error("No URL provided!");
    process.exit(1);
  }

  console.log(`Sandevistan activated for: ${url}`);

  console.log("Syncing profile...");
  spawnSync(
    "rsync",
    [
      "-a",
      "--delete",
      "--exclude=Default/Cache/",
      "--exclude=Default/Code Cache/",
      "--exclude=Default/GPUCache/",
      "--exclude=Default/Service Worker/CacheStorage/",
      `${LIVE_PROFILE}/`,
      `${BOT_PROFILE}/`,
    ],
    { stdio: "inherit" },
  );
  console.log("Profile ready!");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "/opt/google/chrome/google-chrome",
    protocolTimeout: 60000,
    defaultViewport: null,
    args: [
      `--user-data-dir=${BOT_PROFILE}`,
      "--profile-directory=Default",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--start-maximized",
      "--window-position=0,0",
      "--display=:0",
    ],
  });

  // Wait for browser to fully load, reuse existing tab
  await delay(3000);
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());
  await delay(1000);
  // Auto-dismiss any dialogs
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
  });

  try {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await delay(8000);

    let joined = false;

    if (url.includes("zoom.us")) {
      console.log("Zoom detected...");

      const zoomWebUrl = url.includes("/wc/")
        ? url
        : url.replace("/j/", "/wc/join/");

      if (!url.includes("/wc/")) {
        await page.goto(zoomWebUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await delay(5000);
      }

      try {
        await page.waitForSelector('input[name="display_name"]', {
          timeout: 6000,
        });
        await page.click('input[name="display_name"]', { clickCount: 3 });
        await page.type('input[name="display_name"]', "Zaid");
        await page.click("#joinBtn");
        console.log("Zoom joined!");
        joined = true;
      } catch (_) {
        console.log("No name prompt — joining directly...");
        joined = true;
      }

      await delay(5000);
      try {
        const audioBtn = await page.$("button.join-audio-container__btn");
        if (audioBtn) {
          await audioBtn.click();
          console.log("Audio joined");
        }
      } catch (_) {}
      try {
        const muteBtn = await page.$('[aria-label*="Mute my microphone"]');
        if (muteBtn) {
          await muteBtn.click();
          console.log("Zoom mic muted");
        }
      } catch (_) {}
      try {
        const videoBtn = await page.$('[aria-label*="Stop Video"]');
        if (videoBtn) {
          await videoBtn.click();
          console.log("Zoom camera off");
        }
      } catch (_) {}

      //  GOOGLE MEET
    } else {
      console.log("Google Meet detected...");
      await delay(5000);

      if (page.url().includes("accounts.google.com")) {
        throw new Error(
          "Chrome profile is not logged into Google — close Chrome and try again",
        );
      }

      // Step 1: Click "Continue without microphone and camera" if it appears
      try {
        await page.waitForFunction(
          () => {
            const btns = [...document.querySelectorAll("button")];
            return btns.some((b) => /continue without/i.test(b.innerText));
          },
          { timeout: 8000 },
        );

        const buttons = await page.$$("button");
        for (const btn of buttons) {
          const text = await page.evaluate((el) => el.innerText || "", btn);
          if (/continue without/i.test(text)) {
            await btn.click();
            console.log("Clicked: Continue without mic and camera");
            break;
          }
        }
        await delay(2000);
      } catch (_) {
        console.log("No 'Continue without' prompt — skipping");
      }

      try {
        const nameField = await page.$('input[placeholder="Your name"]');
        if (nameField) {
          await nameField.click({ clickCount: 3 });
          await nameField.type("Zaid");
          console.log("Name entered: Zaid");
          // Wait up to 8s for join button to become enabled
          await page
            .waitForFunction(
              () => {
                const btns = [...document.querySelectorAll("button")];
                return btns.some(
                  (b) =>
                    !b.disabled && /(ask to join|join now)/i.test(b.innerText),
                );
              },
              { timeout: 8000 },
            )
            .catch(() => {});
          await delay(500);
        }
      } catch (_) {}

      const joinSelectors = [
        'button[jsname="Qx7uuf"]:not([disabled])',
        'button[jsname="Hnmqjc"]:not([disabled])',
        'button[data-promo-anchor-id="meet-join-button"]:not([disabled])',
      ];

      for (const sel of joinSelectors) {
        try {
          await page.waitForSelector(sel, { timeout: 5000 });
          await page.click(sel);
          console.log("Joined Meet!");
          joined = true;
          break;
        } catch (_) {}
      }

      // Text fallback — only click if not disabled
      if (!joined) {
        const allBtns = await page.$$("button");
        for (const btn of allBtns) {
          const { text, disabled } = await page.evaluate(
            (el) => ({
              text: el.innerText?.toLowerCase() || "",
              disabled: el.disabled,
            }),
            btn,
          );
          if (
            !disabled &&
            (text.includes("ask to join") || text.includes("join now"))
          ) {
            await btn.click();
            console.log("Joined via text match!");
            joined = true;
            break;
          }
        }
      }

      if (!joined) console.log("Join button not found!");
    }

    await delay(3000);

    if (joined) {
      console.log("🔊 Starting the alarm loop...");

      for (let i = 0; i < 10; i++) {
        try {
          const response = await axios({
            method: "post",
            url: "https://ntfy.sh/zaid_wake_up",
            data: ` WAKE UP ZAID! Alert ${i + 1}/10\n${url}`,
            timeout: 10000,
            httpsAgent: ipv4Agent, // Using the agent you defined
            headers: {
              Title: "SANDEVISTAN - CLASS JOINED",
              Priority: "5",
              Tags: "alarm_clock,rotating_light",
            },
          });
          console.log(` Step ${i + 1}: Success (Status: ${response.status})`);
        } catch (err) {
          // THIS IS THE KEY: See the real error
          console.error(
            ` Step ${i + 1} Failed: ${err.code} - ${err.message}`,
          );

          if (err.code === "ECONNREFUSED" || err.code === "EPROTO") {
            console.log("🔄 Retrying without IPv4 Agent...");
            try {
              await axios.post(
                "https://ntfy.sh/zaid_wake_up",
                " WAKE UP (Backup Path)",
                {
                  headers: { Priority: "5" },
                },
              );
              console.log(" Backup Success!");
            } catch (e) {
              console.log(" Backup also failed.");
            }
          }
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    console.log("Sitting silently in class...");

    // Keep alive — move mouse every minute
    setInterval(async () => {
      try {
        await page.mouse.move(
          Math.floor(Math.random() * 600) + 100,
          Math.floor(Math.random() * 400) + 100,
        );
      } catch (_) {}
    }, 60000);
  } catch (e) {
    console.error("Error:", e.message);
    try {
      await axios.post(
        "https://ntfy.sh/zaid_wake_up",
        "Sandevistan FAILED!\n" + e.message,
        {
          timeout: 10000,
          headers: {
            Title: "BOT FAILED",
            Priority: "urgent",
            Tags: "warning",
          },
        },
      );
    } catch (_) {
      console.log("ntfy alert failed too (no internet)");
    }
    await browser.close();
  }
})();
