// server.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Отдаем статические файлы (index.html, app.js, style.css) из корневой папки
app.use(express.static(path.join(__dirname, '/')));

// API-маршрут, который будет отдавать ключи
app.get('/api/config', (req, res) => {
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    };
    res.json(firebaseConfig);
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
