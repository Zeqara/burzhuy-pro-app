document.addEventListener('DOMContentLoaded', () => {
    // ЗАМЕНИТЕ НА АДРЕС ВАШЕГО БЭКЕНДА С RENDER
    const API_BASE_URL = 'https://your-backend-url.onrender.com';

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#121212');
    tg.setBackgroundColor('#121212');

    const screens = document.querySelectorAll('.screen');
    let currentScreen = 'loader';

    // Функция для плавной смены экранов
    function navigateTo(screenId) {
        const oldScreen = document.getElementById(currentScreen);
        const newScreen = document.getElementById(screenId);
        
        if (oldScreen && newScreen) {
            oldScreen.classList.add('exit-left');
            setTimeout(() => {
                oldScreen.classList.remove('active', 'exit-left');
                newScreen.classList.add('active');
                currentScreen = screenId;
            }, 400);
        }
    }

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ ---
    const token = localStorage.getItem('authToken');
    if (token) {
        // Если есть токен, сразу показываем главное меню
        setTimeout(() => navigateTo('main-menu-screen'), 500);
    } else {
        setTimeout(() => navigateTo('auth-screen'), 500);
    }

    // Переключение между входом и регистрацией
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('register-view').style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-view').style.display = 'none';
        document.getElementById('login-view').style.display = 'block';
    });

    // Обработка регистрации
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const authError = document.getElementById('auth-error');
        authError.textContent = '';
        const data = {
            name: document.getElementById('register-name').value,
            phone: document.getElementById('register-phone').value,
            password: document.getElementById('register-password').value
        };

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Ошибка регистрации');
            // После успешной регистрации можно сразу залогинить пользователя или попросить войти
            alert('Регистрация успешна! Теперь вы можете войти.');
            document.getElementById('show-login').click(); // Показать форму входа
        } catch (error) {
            authError.textContent = error.message;
        }
    });
    
    // Обработка входа
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const authError = document.getElementById('auth-error');
        authError.textContent = '';
        const data = {
            phone: document.getElementById('login-phone').value,
            password: document.getElementById('login-password').value
        };

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message || 'Ошибка входа');
            
            localStorage.setItem('authToken', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            navigateTo('main-menu-screen');

        } catch (error) {
            authError.textContent = error.message;
        }
    });

    // Выход из системы
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        navigateTo('auth-screen');
    });

    // --- НАВИГАЦИЯ ПО ПРИЛОЖЕНИЮ ---
    document.querySelectorAll('.menu-btn, .back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetScreen = btn.dataset.target;
            navigateTo(targetScreen);
        });
    });

    // --- ФОРМА ПОДДЕРЖКИ ---
    document.getElementById('support-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('support-status');
        status.textContent = "Отправка...";
        const data = {
            name: document.getElementById('support-name').value,
            phone: document.getElementById('support-phone').value,
            message: document.getElementById('support-message').value,
        };
        try {
            const res = await fetch(`${API_BASE_URL}/api/app/support`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            status.textContent = result.message;
            e.target.reset();
        } catch (error) {
            status.textContent = `Ошибка: ${error.message}`;
        }
    });
});
