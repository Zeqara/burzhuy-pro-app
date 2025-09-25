// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = {
    apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc",
    authDomain: "burzhuy-pro-v2.firebaseapp.com",
    projectId: "burzhuy-pro-v2",
    storageBucket: "burzhuy-pro-v2.appspot.com",
    messagingSenderId: "627105413900",
    appId: "1:627105413900:web:3a02e926867ff76e256729"
};
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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

    // ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ (DOM)
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const registerNameInput = document.getElementById('register-name');
    const registerEmailInput = document.getElementById('register-email');
    const registerPasswordInput = document.getElementById('register-password');
    const registerPhoneInput = document.getElementById('register-phone');
    const logoutBtn = document.getElementById('logout-btn');
    const menuButtons = document.querySelectorAll('.menu-btn');
    const backButtons = document.querySelectorAll('.back-btn');
    const cityListContainer = document.getElementById('city-list');
    const locationsListContainer = document.getElementById('locations-list');
    const locationsHeader = document.getElementById('locations-header');
    const checklistForm = document.getElementById('checklist-form');
    const checklistAddress = document.getElementById('checklist-address');
    const checklistDate = document.getElementById('checklist-date');
    let currentChecklistPoint = null;

    // =================================================================
    // ЛОГИКА АВТОРИЗАЦИИ
    // =================================================================
    if (showRegisterLink && showLoginLink) {
        showRegisterLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; });
        showLoginLink.addEventListener('click', e => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; });
    }
    if (registerForm) {
        registerForm.addEventListener('submit', e => {
            e.preventDefault();
            const name = registerNameInput.value, email = registerEmailInput.value, password = registerPasswordInput.value, phone = registerPhoneInput.value;
            if (!name || !email || !password || !phone) return alert('Пожалуйста, заполните все поля!');
            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => db.collection('users').doc(cred.user.uid).set({ name, phone, email, role: 'guest' }))
                .then(() => { alert('Регистрация прошла успешно!'); registerForm.reset(); showLoginLink.click(); })
                .catch(err => alert(`Ошибка: ${err.message}`));
        });
    }
    if (loginForm) {
        loginForm.addEventListener('submit', e => {
            e.preventDefault();
            const email = loginEmailInput.value, password = loginPasswordInput.value;
            if (!email || !password) return alert('Введите email и пароль.');
            auth.signInWithEmailAndPassword(email, password).catch(err => {
                if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) {
                    alert('Неверный логин или пароль.');
                } else { alert(`Ошибка: ${err.message}`); }
            });
        });
    }

    // =================================================================
    // ЛОГИКА НАВИГАЦИИ
    // =================================================================
    menuButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => { e.preventDefault(); auth.signOut().catch(err => alert(`Ошибка: ${err.message}`)); });
    }

    // =================================================================
    // ЛОГИКА "НАЧАТЬ СОТРУДНИЧЕСТВО"
    // =================================================================
    function renderCityButtons() {
        if (!cityListContainer) return;
        const cities = ["Павлодар", "Экибастуз", "Усть-Каменогорск"];
        cityListContainer.innerHTML = '';
        cities.forEach(city => {
            const button = document.createElement('button');
            button.className = 'menu-btn';
            button.textContent = city;
            button.addEventListener('click', () => renderLocationsForCity(city));
            cityListContainer.appendChild(button);
        });
    }
    function renderLocationsForCity(cityName) {
        if (!locationsListContainer || !locationsHeader) return;
        locationsHeader.textContent = `Точки в г. ${cityName}`;
        locationsListContainer.innerHTML = '<div class="spinner"></div>';
        showScreen('locations-screen');
        db.collection('trading_points').where('city', '==', cityName).get().then(snapshot => {
            locationsListContainer.innerHTML = '';
            if (snapshot.empty) { locationsListContainer.innerHTML = '<p>Нет доступных точек.</p>'; return; }
            snapshot.forEach(doc => {
                const point = doc.data();
                const li = document.createElement('li');
                li.className = 'location-item';
                li.innerHTML = `<strong>${point.name}</strong><small>${point.address}</small>`;
                li.addEventListener('click', () => openChecklistFor(point));
                locationsListContainer.appendChild(li);
            });
        }).catch(error => { console.error("Ошибка: ", error); locationsListContainer.innerHTML = '<p>Не удалось загрузить точки.</p>'; });
    }

    // =================================================================
    // ЛОГИКА ЧЕК-ЛИСТА
    // =================================================================
    function openChecklistFor(pointData) {
        if (!checklistAddress || !checklistDate || !checklistForm) return;
        currentChecklistPoint = pointData;
        checklistAddress.textContent = pointData.address;
        checklistDate.textContent = new Date().toLocaleString('ru-RU');
        checklistForm.reset();
        showScreen('checklist-screen');
    }
    if (checklistForm) {
        checklistForm.addEventListener('submit', e => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return alert('Ошибка: вы не авторизованы.');
            const reportData = {
                userId: user.uid, userEmail: user.email, pointName: currentChecklistPoint.name, pointAddress: currentChecklistPoint.address, checkDate: new Date(),
                answers: {
                    q1_appearance: document.getElementById('checklist-q1-appearance').value, q2_cleanliness: document.getElementById('checklist-q2-cleanliness').value,
                    q3_greeting: document.getElementById('checklist-q3-greeting').value, q4_upsell: document.getElementById('checklist-q4-upsell').value,
                    q5_actions: document.getElementById('checklist-q5-actions').value, q6_handout: document.getElementById('checklist-q6-handout').value,
                    q7_order_eval: document.getElementById('checklist-q7-order-eval').value, q8_food_rating: document.getElementById('checklist-q8-food-rating').value,
                    q9_comments: document.getElementById('checklist-q9-comments').value,
                }
            };
            db.collection('reports').add(reportData).then(() => {
                alert('Спасибо за ваш отчёт ✅ На проверку отчёта уходит до 12 часов (будние дни).');
                showScreen('main-menu-screen');
            }).catch(error => { console.error("Ошибка при отправке отчета: ", error); alert('Не удалось отправить отчет.'); });
        });
    }

    // =================================================================
    // ГЛАВНЫЙ КОНТРОЛЛЕР
    // =================================================================
    auth.onAuthStateChanged(user => {
        if (user) {
            showScreen('main-menu-screen');
            renderCityButtons();
        } else {
            showScreen('auth-screen');
        }
    });
});
