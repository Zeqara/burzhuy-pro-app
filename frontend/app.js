// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let confirmationResult = null; // Глобальная переменная для хранения результата подтверждения

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: НАВИГАЦИЯ
// =================================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
}

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ВСЕГО ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Элементы для новой аутентификации ---
    const phoneForm = document.getElementById('phone-form');
    const phoneInput = document.getElementById('phone-input');
    const sendCodeBtn = document.getElementById('send-code-btn');
    const codeForm = document.getElementById('code-form');
    const codeInput = document.getElementById('code-input');
    const phoneView = document.getElementById('phone-view');
    const codeView = document.getElementById('code-view');
    const profileSetupForm = document.getElementById('profile-setup-form');
    const profileNameInput = document.getElementById('profile-name-input');
    const userNameDisplay = document.getElementById('user-name-display');
    const logoutBtn = document.getElementById('logout-btn');

    // Настраиваем невидимую reCAPTCHA
    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible'
    });

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ ПО ТЕЛЕФОНУ ---
    
    // Шаг 1: Отправка кода на телефон
    phoneForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
        // 1. Берем значение из поля ввода
        let rawPhoneNumber = phoneInput.value;
        // 2. Убираем все, кроме цифр
        let digitsOnly = rawPhoneNumber.replace(/\D/g, '');
        // 3. Если номер начинается с 8, заменяем на 7 (стандарт для РФ/КЗ)
        if (digitsOnly.startsWith('8')) {
            digitsOnly = '7' + digitsOnly.substring(1);
        }
        // 4. Собираем итоговый номер в международном формате
        const formattedPhoneNumber = `+${digitsOnly}`;
        
        // 5. Проверяем итоговую длину
        if (digitsOnly.length < 11) {
            alert('Пожалуйста, введите полный номер телефона.');
            return;
        }
        // --- КОНЕЦ ИЗМЕНЕНИЯ ---

        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = 'Отправка...';

        auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier) // Используем отформатированный номер
            .then(result => {
                confirmationResult = result;
                phoneView.style.display = 'none';
                codeView.style.display = 'block';
                alert('СМС-код отправлен на ваш номер.');
            })
            .catch(err => {
                console.error("Ошибка reCAPTCHA или отправки SMS:", err);
                alert(`Ошибка отправки кода. Убедитесь, что номер введен правильно, и попробуйте обновить страницу.`);
            })
            .finally(() => {
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = 'Получить код';
            });
    });

    // Шаг 2: Проверка СМС-кода
    codeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = codeInput.value;
        if (!code) return alert('Введите код из СМС');
        if (!confirmationResult) return alert('Сначала запросите код.');

        confirmationResult.confirm(code)
            .then(result => {
                // Пользователь успешно вошел. Дальнейшую логику обработает onAuthStateChanged.
            })
            .catch(err => {
                alert(`Неверный код. Попробуйте еще раз.`);
            });
    });
    
    // Шаг 3: Сохранение профиля нового пользователя
    profileSetupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        const fullName = profileNameInput.value.trim();

        if (!user || !fullName) return alert('Введите ваше имя и фамилию.');

        db.collection('users').doc(user.uid).set({
            fullName: fullName,
            phone: user.phoneNumber,
            role: 'guest'
        })
        .then(() => {
            userNameDisplay.textContent = fullName;
            showScreen('main-menu-screen');
        })
        .catch(err => {
            alert(`Не удалось сохранить профиль: ${err.message}`);
        });
    });

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЯ ---
    auth.onAuthStateChanged(user => {
        if (user) {
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    userNameDisplay.textContent = userData.fullName;
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            });
        } else {
            phoneView.style.display = 'block';
            codeView.style.display = 'none';
            phoneForm.reset();
            codeForm.reset();
            showScreen('auth-screen');
        }
    });

    // Выход из системы
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut();
    });

    // --- Логика навигации по меню (остается без изменений) ---
    const menuButtons = document.querySelectorAll('.menu-btn');
    menuButtons.forEach(b => { 
        b.addEventListener('click', () => { 
            const id = b.dataset.target; 
            showScreen(id); 
        }); 
    });
    
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(b => { 
        b.addEventListener('click', () => showScreen(b.dataset.target)); 
    });
});
