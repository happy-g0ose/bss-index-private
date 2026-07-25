# 🤖 BSS Index Discord Bot Setup Guide

Инструкция по запуск официального Discord-бота для сервера **BSS Index**!

---

## 🛠 Быстрый старт (за 3 минуты)

### Шаг 1: Создание бота в Discord Developer Portal
1. Перейдите на сайт [Discord Developer Portal](https://discord.com/developers/applications).
2. Нажмите кнопку **New Application** вверху справа.
3. Введите название приложения: `BSS Index Bot` и нажмите **Create**.
4. В левом меню перейдите во вкладку **Bot**:
   * Скопируйте **Application ID** (на первой вкладке General Information) -> это ваш `CLIENT_ID`.
   * Нажмите **Reset Token** -> скопируйте секретный Токен бота -> это ваш `DISCORD_TOKEN`.
5. Включите переключатели в разделе **Privileged Gateway Intents**:
   * ✅ **Message Content Intent**

---

### Шаг 2: Настройка файла `.env`
1. Откройте папку `bot/` в вашем проекте.
2. Откройте файл `.env` и вставьте ваши ключи:
```env
DISCORD_TOKEN=ваш_токен_бота_здесь
CLIENT_ID=ваш_client_id_здесь
```

---

### Шаг 3: Приглашение бота на ваш сервер
1. В Developer Portal перейдите во вкладку **OAuth2** -> **URL Generator**.
2. В блоке **Scopes** отметьте галочками:
   * `bot`
   * `applications.commands`
3. В появившемся блоке **Bot Permissions** отметьте:
   * `Send Messages`
   * `Embed Links`
   * `Use Slash Commands`
4. Скопируйте сгенерированную ссылку внизу страницы, откройте ее в браузере и добавьте бота на ваш Discord сервер **BSS index**!

---

### Шаг 4: Запуск бота
В терминале вызовите команды:

```bash
cd bot
npm install
npm start
```

Все готово! Бот подключится к серверу, зарегистрирует команды `/price`, `/calc`, `/site` и установит статус активности. 🚀

---

## 🤖 Команды бота

| Команда | Описание |
|---|---|
| `/price [предмет]` | Мгновенный поиск цен, спроса и графиков предмета с автозаполнением |
| `/calc [отдаем] [получаем]` | Быстрый калькулятор обмена прямо в чате Discord (Win/Fair/Loss) |
| `/site` | Выдает ссылку на сайт BSS Index и обзор функций |
| `/setup-welcome` | (Админ) Красиво оформляет канал welcome/правила со ссылками на сайт |
