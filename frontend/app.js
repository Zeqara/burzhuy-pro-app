// =================================================================
// КОНФИГУРАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc",
  authDomain: "burzhuy-pro-v2.firebaseapp.com",
  projectId: "burzhuy-pro-v2",
  storageBucket: "burzhuy-pro-v2.appspot.com",
  messagingSenderId: "627105413900",
  appId: "1:627105413900:web:3a02e926867ff76e256729"
};

// =================================================================
// ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =================================================================
// ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ СО СТРАНИЦЫ
// =================================================================
// Экраны
const authScreen = document.getElementById('auth-screen');
const mainMenuScreen = document.getElementById('main-menu-screen');

// Формы и контейнеры авторизации
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

// Поля входа
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');

// Поля регистрации
const registerNameInput = document.getElementById('register-name');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const registerPhoneInput = document.getElementById('register-phone');

// Кнопки навигации
const logoutBtn = document.getElementById('logout-btn');
const menuButtons = document.querySelectorAll('.menu-btn');
const backButtons = document.querySelectorAll('.back-btn');


// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ НАВИГАЦИИ
// =================================================================
function showScreen(screenId) {
    // Сначала скроем все экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    // Затем покажем нужный
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// =================================================================
// ЛОГИКА АВТОРИЗАЦИИ (Вход, Регистрация, Переключение)
// =================================================================
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.style.display = 'none';
    registerView.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerView.style.display = 'none';
    loginView.style.display = 'block';
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = registerNameInput.value, email = registerEmailInput.value, password = registerPasswordInput.value, phone = registerPhoneInput.value;
    if (!name || !email || !password || !phone) return alert('Пожалуйста, заполните все поля!');
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const user = userCredential.user;
            return db.collection('users').doc(user.uid).set({ name, phone, email, role: 'guest' });
        })
        .then(() => {
            alert('Регистрация прошла успешно! Теперь вы можете войти.');
            registerForm.reset();
            showLoginLink.click(); // Имитируем клик по ссылке "Войти"
        })
        .catch(error => alert(`Ошибка: ${error.message}`));
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginEmailInput.value, password = loginPasswordInput.value;
    if (!email || !password) return alert('Пожалуйста, введите email и пароль.');

    auth.signInWithEmailAndPassword(email, password)
        .then(() => showScreen('main-menu-screen')) // Переход на главный экран
        .catch(error => {
            if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
                alert('Неверный логин или пароль.');
            } else {
                alert(`Ошибка: ${error.message}`);
            }
        });
});

// =================================================================
// ЛОГИКА НАВИГАЦИИ ПО МЕНЮ И ВЫХОДА
// =================================================================

// Обработка кликов по кнопкам главного меню
menuButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetScreenId = button.dataset.target;
        showScreen(targetScreenId);
    });
});

// Обработка кликов по всем кнопкам "Назад"
backButtons.forEach(button => {
    button.addEventListener('click', () => {
        const targetScreenId = button.dataset.target;
        showScreen(targetScreenId);
    });
});

// Обработка клика по кнопке "Выйти"
logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    auth.signOut()
        .then(() => {
            loginForm.reset(); // Очищаем поля формы входа
            showScreen('auth-screen'); // Возвращаемся на экран авторизации
        })
        .catch(error => alert(`Ошибка при выходе: ${error.message}`));
});

// =================================================================
// ПРОВЕРКА СТАТУСА АВТОРИЗАЦИИ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// =================================================================
auth.onAuthStateChanged(user => {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none'; // Скрываем загрузчик в любом случае

    if (user) {
        // Пользователь вошел в систему
        showScreen('main-menu-screen');
    } else {
        // Пользователь не вошел в систему
        showScreen('auth-screen');
    }
});
