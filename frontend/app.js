// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let confirmationResult = null; 

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
    // --- DOM Элементы ---
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

    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible'
    });

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ ПО ТЕЛЕФОН ---
    phoneForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let rawPhoneNumber = phoneInput.value;
        let digitsOnly = rawPhoneNumber.replace(/\D/g, '');
        if (digitsOnly.startsWith('8')) {
            digitsOnly = '7' + digitsOnly.substring(1);
        }
        const formattedPhoneNumber = `+${digitsOnly}`;
        
        if (digitsOnly.length < 11) {
            alert('Пожалуйста, введите полный номер телефона.');
            return;
        }

        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = 'Отправка...';

        auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier)
            .then(result => {
                confirmationResult = result;
                phoneView.style.display = 'none';
                codeView.style.display = 'block';
                alert('СМС-код отправлен на ваш номер.');
            })
            .catch(err => {
                // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
                // Мы выводим полную техническую ошибку от Firebase
                console.error("Firebase Error:", err);
                alert(`Произошла ошибка: \nКод: ${err.code}\nСообщение: ${err.message}`);
                // --- КОНЕЦ ИЗМЕНЕНИЯ ---
            })
            .finally(() => {
                sendCodeBtn.disabled = false;
                sendCodeBtn.textContent = 'Получить код';
            });
    });

    // Остальная часть файла без изменений...
    codeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = codeInput.value;
        if (!code) return alert('Введите код из СМС');
        if (!confirmationResult) return alert('Сначала запросите код.');

        confirmationResult.confirm(code)
            .then(result => {})
            .catch(err => {
                alert(`Неверный код. Попробуйте еще раз.`);
            });
    });
    
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

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut();
    });

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
