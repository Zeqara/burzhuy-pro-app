const express = require('express');
const router = express.Router();
// Здесь в будущем будет логика для получения городов, точек, чек-листов и т.д.
// Пока что оставим его простым для демонстрации.

router.get('/cities', (req, res) => {
    res.json([
        { id: 'pavlodar', name: 'Павлодар' },
        { id: 'ekibastuz', name: 'Экибастуз' },
        { id: 'oskemen', name: 'Усть-Каменогорск' },
    ]);
});

// В реальном приложении данные будут браться из БД
const locations = {
    pavlodar: [
        { id: 'b1', address: 'ул. Лермонтова 98/1' },
        { id: 'b2', address: 'Ломова 52' },
        { id: 'b3', address: 'Чокина 143' },
        // ... и так далее
    ],
    ekibastuz: [
        { id: 'b16', address: 'Ауэзова 49Б/1' },
         // ... и так далее
    ],
    oskemen: [
        { id: 'b27', address: 'Проспект Сатпаева 84/7' },
         // ... и так далее
    ]
};

router.get('/locations/:cityId', (req, res) => {
    const cityLocations = locations[req.params.cityId] || [];
    res.json(cityLocations);
});

// Маршрут для техподдержки
router.post('/support', (req, res) => {
    const { name, phone, message } = req.body;
    console.log(`Новое обращение в поддержку от ${name} (${phone}): ${message}`);
    res.status(200).json({ message: "Ваше обращение отправлено!" });
});


module.exports = router;
