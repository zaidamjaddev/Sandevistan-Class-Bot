const http = require('http');
const { exec } = require('child_process');

const PORT = 3333;

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    return res.end('Method not allowed');
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      const { link } = JSON.parse(body);
      if (!link) {
        res.writeHead(400);
        return res.end(JSON.stringify({ error: 'No link provided' }));
      }

      console.log(`🚀 Received link: ${link}`);

      // Run the bot in background — don't block the response
      exec(`node /home/zaid/sandevistan_scripts/join.js "${link}"`, (err, stdout, stderr) => {
        if (err) console.error('Bot error:', err.message);
        if (stdout) console.log('Bot output:', stdout);
        if (stderr) console.error('Bot stderr:', stderr);
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'success', 
        message: 'Bot launched!',
        link 
      }));

    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Bridge running on port ${PORT}`);
  console.log(`📡 Waiting for n8n to send meeting links...`);
});
