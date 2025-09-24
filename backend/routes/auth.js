const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
    const { name, phone, password } = req.body;
    if (!name || !phone || !password) {
        return res.status(400).json({ message: "Все поля обязательны" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await db.query(
            "INSERT INTO users (name, phone, password_hash, role) VALUES ($1, $2, $3, 'agent') RETURNING id, name, role",
            [name, phone, hashedPassword]
        );
        res.status(201).json(newUser.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера при регистрации" });
    }
});

// Вход
router.post('/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const userResult = await db.query("SELECT * FROM users WHERE phone = $1", [phone]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: "Неверный номер телефона или пароль" });
        }
        
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: "Неверный номер телефона или пароль" });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Ошибка сервера" });
    }
});

module.exports = router;
