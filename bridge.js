const http = require('http');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3333;

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

      console.log(`Received link from n8n: ${link}`);

      // Path handling 
      const joinScriptPath = path.join(__dirname, 'join.js');

      // Detect shell command based on OS
      const cmd = `node "${joinScriptPath}" "${link}"`;

      exec(cmd, (err, stdout, stderr) => {
        if (err) console.error('Bot execution error:', err.message);
        if (stdout) console.log('Bot output:', stdout);
        if (stderr) console.error('Bot stderr:', stderr);
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'success', 
        message: `Sandevistan Bridge: Bot launched on ${os.platform()}!`,
        link 
      }));

    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Bridge active on port ${PORT}`);
  console.log(`Waiting for n8n to send meeting links...`);
});