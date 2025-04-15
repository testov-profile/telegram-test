import express from 'express';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import dotenv from 'dotenv';
import cors from 'cors';
import { WebSocketServer } from 'ws';

dotenv.config();

const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const sessionString = process.env.TELEGRAM_SESSION;
const stringSession = new StringSession(sessionString);

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

let dotVisible = false;
const clients = new Set(); // пазим активни WebSocket клиенти

// Създаваме WS сървър върху HTTP сървъра
const server = app.listen(PORT, () => {
  console.log(`HTTP/WS server running on port ${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected.');
  clients.add(ws);

  // Пращаме текущото състояние веднага
  ws.send(JSON.stringify({ visible: dotVisible }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected.');
  });
});

// Telegram слушач
async function startTelegramClient() {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.connect();
  console.log('Telegram client connected.');

  client.addEventHandler(async (event) => {
    dotVisible = !dotVisible;

    // Изпращаме на всички клиенти новото състояние
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ visible: dotVisible }));
      }
    }

    console.log('New Telegram message. Dot is now:', dotVisible);
  }, new NewMessage({}));

  return client;
}

startTelegramClient();
