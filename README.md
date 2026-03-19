🎓 Sandevistan: The Automated Class Attendee

Sandevistan is an automated agent built to handle the struggle of 8:00 AM online classes. It monitors your WhatsApp messages for meeting links, joins the class on your behalf (with mic and camera off), and then blasts an urgent notification to your phone so you can wake up and take over.
🚀 How it Works

    Monitor: Evolution API (Docker) connects to WhatsApp and forwards messages to n8n.

    Brain: n8n (Docker) parses the message, extracts the Google Meet/Zoom link, and verifies it's within class hours (8 AM – 3 PM).

    Bridge: n8n calls a Node.js bridge running on your host machine.

    Execution: A Puppeteer Stealth script launches Chrome, syncs your local profile, mutes everything, and joins the call.

    Wake Up: Once inside, a high-priority alert is sent to your phone via ntfy.sh.

🛠️ Tech Stack

    Automation: Puppeteer + Puppeteer Stealth

    WhatsApp: Evolution API (v2)

    Workflow Engine: n8n

    Database: PostgreSQL (for session persistence)

    Cache: Redis

    Alerts: ntfy (Android/iOS)

    Process Management: PM2

📦 Installation & Setup
1. Prerequisites

    Docker & Docker Compose

    Node.js (v18+)

    Google Chrome installed on your OS

2. Deploy the Stack (Docker)

This command launches Evolution API, n8n, Postgres, and Redis:

docker-compose up -d


3. Setup the Local Scripts

Install the necessary dependencies and prepare your environment:

# Install dependencies
npm install

# Configure your environment
cp .env.example .env

4. Run the Bridge

The bridge allows the Dockerized n8n to communicate with your host's Chrome. Use PM2 to keep it alive 24/7:

pm2 start bridge.js --name "sandevistan-bridge"


📋 Environment Variables (.env)
Variable	Description
STUDENT_NAME	The name typed into the meeting if not logged in.
NTFY_TOPIC	A secret topic name for your phone alerts.


🛑 Disclaimer

This project is for educational purposes. Use of unofficial APIs may violate WhatsApp's Terms of Service. Use at your own risk! The author is not responsible for missed attendance or grumpy professors!
📄 License

This project is licensed under the MIT License - see the LICENSE file for details.