// =================================================================
// ВАША КОНФИГУРАЦИЯ FIREBASE (УЖЕ ВСТАВЛЕНА)
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc",
  authDomain: "burzhuy-pro-v2.firebaseapp.com",
  projectId: "burzhuy-pro-v2",
  storageBucket: "burzhuy-pro-v2.appspot.com",
  messagingSenderId: "627105413900",
  appId: "1:627105413900:web:3a02e926867ff76e256729",
  measurementId: "G-VZJQET0HSW"
};

// =================================================================
// ИНИЦИАЛИЗАЦИЯ FIREBASE И ПОДКЛЮЧЕНИЕ СЕРВИСОВ
// =================================================================
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =================================================================
// ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ СО СТРАНИЦЫ
// =================================================================
// Формы
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Ссылки для переключения форм
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

// Поля формы входа
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');

// Поля формы регистрации
const registerNameInput = document.getElementById('register-name');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const registerPhoneInput = document.getElementById('register-phone');
const registerCityInput = document.getElementById('register-city');
const registerButton = document.getElementById('register-button');

// =================================================================
// ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ФОРМ
// =================================================================
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault(); // Отменяем стандартное поведение ссылки
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault(); // Отменяем стандартное поведение ссылки
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
});

// =================================================================
// ЛОГИКА РЕГИСТРАЦИИ
// =================================================================
registerButton.addEventListener('click', () => {
    // Получаем данные из полей
    const name = registerNameInput.value;
    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;
    const phone = registerPhoneInput.value;
    const city = registerCityInput.value;

    // Простая проверка на заполненность
    if (!name || !email || !password || !phone || !city) {
        alert('Пожалуйста, заполните все поля!');
        return;
    }

    // 1. Создаем пользователя в Firebase Authentication
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Пользователь успешно создан
            const user = userCredential.user;
            
            // 2. Сохраняем доп. информацию в базу данных Firestore
            // Мы создаем документ в коллекции 'users' с ID, равным ID пользователя
            return db.collection('users').doc(user.uid).set({
                name: name,
                phone: phone,
                city: city,
                email: email, // Дублируем email для удобства
                role: 'guest' // Назначаем роль по умолчанию
            });
        })
        .then(() => {
            alert('Регистрация прошла успешно! Теперь вы можете войти.');
            // Автоматически переключаем на форму входа
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
        })
        .catch((error) => {
            // Обработка ошибок
            console.error("Ошибка при регистрации: ", error);
            alert(`Ошибка: ${error.message}`);
        });
});

// =================================================================
// ЛОГИКА ВХОДА
// =================================================================
loginButton.addEventListener('click', () => {
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (!email || !password) {
        alert('Пожалуйста, введите email и пароль.');
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Пользователь успешно вошел
            const user = userCredential.user;
            alert(`Добро пожаловать, ${user.email}!`);
            // TODO: Здесь будет переход на главный экран приложения
            // Например: window.location.href = '/dashboard.html';
        })
        .catch((error) => {
            console.error("Ошибка при входе: ", error);
            // Улучшаем сообщение об ошибке для пользователя
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                alert('Неверный логин или пароль.');
            } else {
                alert(`Ошибка: ${error.message}`);
            }
        });
});
