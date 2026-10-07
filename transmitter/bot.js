import TelegramBot from 'node-telegram-bot-api';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedUsername = process.env.ALLOWED_USERNAME;

if (!token) {
  console.error("Please provide TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

console.log("Transmitter Bot is running...");

// Middleware to check if the user is authorized
const isAuthorized = (msg) => {
  if (msg.from.username !== allowedUsername) {
    bot.sendMessage(msg.chat.id, "⛔ У вас нет доступа к этому боту.");
    return false;
  }
  return true;
};

// Help command
bot.onText(/\/help/, (msg) => {
  if (!isAuthorized(msg)) return;

  const helpText = `
🤖 *Transmitter Bot*
Привет! Я твой личный помощник для управления проектом.

Доступные команды:
/cmd <команда> - выполнить команду в терминале (например: /cmd git status)
/read <файл> - прочитать содержимое файла
/ls <директория> - посмотреть файлы в папке
/ping - проверить статус работы

Просто напиши мне, и я помогу тебе управлять кодом удаленно!
  `;
  bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
});

bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) return;
    bot.sendMessage(msg.chat.id, "Привет! Система Transmitter запущена. Отправь /help для списка команд.");
});

// Execute terminal commands
bot.onText(/\/cmd (.+)/, (msg, match) => {
  if (!isAuthorized(msg)) return;

  const command = match[1];
  const rootDir = path.resolve(process.cwd(), '..'); // Assuming transmitter is inside the project
  bot.sendMessage(msg.chat.id, `⏳ Выполняю: \`${command}\`...`, { parse_mode: 'Markdown' });

  exec(command, { cwd: rootDir }, (error, stdout, stderr) => {
    let response = "";
    if (error) {
      response += `*Error:*\n\`\`\`\n${error.message}\n\`\`\`\n`;
    }
    if (stderr) {
      response += `*Stderr:*\n\`\`\`\n${stderr}\n\`\`\`\n`;
    }
    if (stdout) {
      response += `*Output:*\n\`\`\`\n${stdout}\n\`\`\`\n`;
    }

    if (!response) response = "✅ Команда выполнена, но нет вывода.";
    
    // Telegram message length limit is 4096
    if (response.length > 4000) {
        response = response.substring(0, 4000) + "\n... (вывод обрезан)";
    }

    bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
  });
});

// Read files
bot.onText(/\/read (.+)/, (msg, match) => {
  if (!isAuthorized(msg)) return;

  const filePath = match[1];
  const rootDir = path.resolve(process.cwd(), '..');
  const fullPath = path.resolve(rootDir, filePath);

  try {
    const data = fs.readFileSync(fullPath, 'utf8');
    let response = `*File:* \`${filePath}\`\n\`\`\`\n${data}\n\`\`\``;
    
    if (response.length > 4000) {
        response = response.substring(0, 4000) + "\n... (файл слишком большой, обрезан)";
    }
    
    bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(msg.chat.id, `❌ Ошибка при чтении файла:\n\`\`\`\n${err.message}\n\`\`\``, { parse_mode: 'Markdown' });
  }
});

// List directory
bot.onText(/\/ls (.+)/, (msg, match) => {
    if (!isAuthorized(msg)) return;
  
    const dirPath = match[1];
    const rootDir = path.resolve(process.cwd(), '..');
    const fullPath = path.resolve(rootDir, dirPath);
  
    try {
      const files = fs.readdirSync(fullPath);
      let response = `*Directory:* \`${dirPath}\`\n\n` + files.map(f => `- ${f}`).join('\n');
      
      bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ Ошибка:\n\`\`\`\n${err.message}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  });

// Handle general messages
bot.on('message', (msg) => {
  if (!isAuthorized(msg)) return;
  if (msg.text && msg.text.startsWith('/')) return; // Ignore commands

  // If you want to connect AI later, you can intercept normal messages here
  bot.sendMessage(msg.chat.id, "Я принял твоё сообщение. Для выполнения команд используй /cmd, /read, или /help.");
});

// Ping
bot.onText(/\/ping/, (msg) => {
    if (!isAuthorized(msg)) return;
    bot.sendMessage(msg.chat.id, "🟢 Бот активен и готов к работе!");
});
