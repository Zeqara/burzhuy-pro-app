document.addEventListener('DOMContentLoaded', () => {
    // --- ШАГ 1: ВСТАВЬТЕ ВАШИ КЛЮЧИ FIREBASE СЮДА ---
    const firebaseConfig = {
        apiKey: "AIzaSy...",
        authDomain: "your-project-id.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project-id.appspot.com",
        messagingSenderId: "...",
        appId: "1:..."
    };
    // ----------------------------------------------------

    // Инициализация Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAEEIRVkDj2MTSoI_P7iNtdGqj3Rn_GW-A",
  authDomain: "burzhuy-pro-app.firebaseapp.com",
  projectId: "burzhuy-pro-app",
  storageBucket: "burzhuy-pro-app.firebasestorage.app",
  messagingSenderId: "621600130598",
  appId: "1:621600130598:web:5991bcf446b7b0cff088e7",
  measurementId: "G-WBLLKPFF6B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

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

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ FIREBASE ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // Пользователь вошел в систему
            console.log("Пользователь вошел:", user.uid);
            navigateTo('main-menu-screen');
        } else {
            // Пользователь вышел
            console.log("Пользователь вышел.");
            navigateTo('auth-screen');
        }
    });

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
        const name = document.getElementById('register-name').value;
        const phone = document.getElementById('register-phone').value;
        const password = document.getElementById('register-password').value;

        // Используем email как логин, добавляя фиктивный домен
        const email = `${phone}@agent.burzhuy`; 
        authError.textContent = '';

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Сохраняем доп. информацию в Firestore
            await db.collection('users').doc(user.uid).set({
                name: name,
                phone: phone,
                role: 'agent',
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Система автоматически перекинет на главный экран через onAuthStateChanged
        } catch (error) {
            authError.textContent = "Ошибка регистрации: " + error.message;
        }
    });
    
    // Обработка входа
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const authError = document.getElementById('auth-error');
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;
        const email = `${phone}@agent.burzhuy`;
        authError.textContent = '';

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // Система автоматически перекинет на главный экран
        } catch (error) {
            authError.textContent = "Ошибка входа: " + error.message;
        }
    });

    // Выход из системы
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut();
    });

    // --- НАВИГАЦИЯ ПО ПРИЛОЖЕНИЮ --- (остается без изменений)
    document.querySelectorAll('.menu-btn, .back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.target);
        });
    });

    // --- ФОРМА ПОДДЕРЖКИ С FIREBASE ---
    document.getElementById('support-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('support-status');
        status.textContent = "Отправка...";
        
        try {
            await db.collection('supportTickets').add({
                name: document.getElementById('support-name').value,
                phone: document.getElementById('support-phone').value,
                message: document.getElementById('support-message').value,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: auth.currentUser ? auth.currentUser.uid : 'guest'
            });

            status.textContent = "Ваше обращение отправлено!";
            e.target.reset();
        } catch (error) {
            status.textContent = `Ошибка: ${error.message}`;
        }
    });

    // Первичный запуск
    setTimeout(() => {
         if (!auth.currentUser) {
            navigateTo('auth-screen');
         }
    }, 500);
});
