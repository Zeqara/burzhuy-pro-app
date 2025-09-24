const express = require('express');
const cors = require('cors');
const db = require('./db'); // Мы создадим этот файл следующим
const authRoutes = require('./routes/auth');
const appRoutes = require('./routes/app');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/app', appRoutes);

// Тестовый роут
app.get('/', (req, res) => {
    res.send('Backend "Тайный агент BURЖУЙ" работает!');
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
