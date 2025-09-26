// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
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
    const loginView = document.getElementById('login-view'), registerView = document.getElementById('register-view'), loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form'), showRegisterLink = document.getElementById('show-register'), showLoginLink = document.getElementById('show-login'), loginEmailInput = document.getElementById('login-email'), loginPasswordInput = document.getElementById('login-password'), registerNameInput = document.getElementById('register-name'), registerEmailInput = document.getElementById('register-email'), registerPasswordInput = document.getElementById('register-password'), registerPhoneInput = document.getElementById('register-phone');
    const logoutBtn = document.getElementById('logout-btn'), menuButtons = document.querySelectorAll('.menu-btn'), backButtons = document.querySelectorAll('.back-btn');
    const cityListContainer = document.getElementById('city-list'), locationsListContainer = document.getElementById('locations-list'), locationsHeader = document.getElementById('locations-header');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');
    let currentChecklistPoint = null;

    // ЛОГИКА АВТОРИЗАЦИИ
    if (showRegisterLink) { showRegisterLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; }); }
    if (showLoginLink) { showLoginLink.addEventListener('click', e => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; }); }
    if (registerForm) { registerForm.addEventListener('submit', e => { e.preventDefault(); const n = registerNameInput.value, m = registerEmailInput.value, p = registerPasswordInput.value, t = registerPhoneInput.value; if (!n || !m || !p || !t) return alert('Заполните все поля!'); auth.createUserWithEmailAndPassword(m, p).then(c => db.collection('users').doc(c.user.uid).set({ name: n, phone: t, email: m, role: 'guest' })).then(() => { alert('Успешно!'); registerForm.reset(); showLoginLink.click(); }).catch(err => alert(`Ошибка: ${err.message}`)); }); }
    if (loginForm) { loginForm.addEventListener('submit', e => { e.preventDefault(); const m = loginEmailInput.value, p = loginPasswordInput.value; if (!m || !p) return alert('Введите email и пароль.'); auth.signInWithEmailAndPassword(m, p).catch(err => { if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) { alert('Неверный логин или пароль.'); } else { alert(`Ошибка: ${err.message}`); } }); }); }

    // ЛОГИКА НАВИГАЦИИ
    menuButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    if (logoutBtn) { logoutBtn.addEventListener('click', e => { e.preventDefault(); auth.signOut().catch(err => alert(`Ошибка: ${err.message}`)); }); }

    // ЛОГИКА "НАЧАТЬ СОТРУДНИЧЕСТВО"
    function renderCityButtons() { if (!cityListContainer) return; const cities = ["Павлодар", "Экибастуз", "Усть-Каменогорск"]; cityListContainer.innerHTML = ''; cities.forEach(city => { const button = document.createElement('button'); button.className = 'menu-btn'; button.textContent = city; button.addEventListener('click', () => renderLocationsForCity(city)); cityListContainer.appendChild(button); }); }
    function renderLocationsForCity(cityName) {
        if (!locationsListContainer || !locationsHeader) return;
        locationsHeader.textContent = `Точки в г. ${cityName}`;
        locationsListContainer.innerHTML = '<div class="spinner"></div>';
        showScreen('locations-screen');
        db.collection('locations').where('city', '==', cityName).get().then(snapshot => {
            locationsListContainer.innerHTML = '';
            if (snapshot.empty) { locationsListContainer.innerHTML = '<p>Нет доступных точек.</p>'; return; }
            snapshot.forEach(doc => {
                const point = doc.data();
                const li = document.createElement('li');
                li.className = 'location-item';
                li.innerHTML = `<strong>${point.name}</strong><small>${point.address}</small>`;
                // =================================================
                // ИСПРАВЛЕНИЕ ЗДЕСЬ: Убираем alert, вызываем функцию
                // =================================================
                li.addEventListener('click', () => openChecklistFor(point));
                locati
