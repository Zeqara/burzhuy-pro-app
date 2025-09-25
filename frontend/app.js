// =================================================================
// КОНФИГУРАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", // Ваш ключ, не меняйте
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
const authScreen = document.getElementById('auth-screen');
const mainMenuScreen = document.getElementById('main-menu-screen');

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

// =================================================================
// ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ФОРМ
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

// =================================================================
// ЛОГИКА РЕГИСТРАЦИИ
// =================================================================
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = registerNameInput.value;
    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;
    const phone = registerPhoneInput.value;

    if (!name || !email || !password || !phone) {
        alert('Пожалуйста, заполните все поля!');
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return db.collection('users').doc(user.uid).set({
                name: name,
                phone: phone,
                email: email,
                role: 'guest'
            });
        })
        .then(() => {
            alert('Регистрация прошла успешно! Теперь вы можете войти.');
            registerForm.reset(); // Очищаем поля формы
            registerView.style.display = 'none';
            loginView.style.display = 'block';
        })
        .catch((error) => {
            console.error("Ошибка при регистрации: ", error);
            alert(`Ошибка: ${error.message}`);
        });
});

// =================================================================
// ЛОГИКА ВХОДА
// =================================================================
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (!email || !password) {
        alert('Пожалуйста, введите email и пароль.');
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Успешный вход
            
            // Переключаем экраны
            authScreen.classList.remove('active');
            mainMenuScreen.classList.add('active');
        })
        .catch((error) => {
            console.error("Ошибка при входе: ", error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                alert('Неверный логин или пароль.');
            } else {
                alert(`Ошибка: ${error.message}`);
            }
        });
});
