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
    const historyListContainer = document.getElementById('history-list');
    let currentChecklistPoint = null;

    // ЛОГИКА АВТОРИЗАЦИИ
    if (showRegisterLink) { showRegisterLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; }); }
    if (showLoginLink) { showLoginLink.addEventListener('click', e => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; }); }
    if (registerForm) { registerForm.addEventListener('submit', e => { e.preventDefault(); const n = registerNameInput.value, m = registerEmailInput.value, p = registerPasswordInput.value, t = registerPhoneInput.value; if (!n || !m || !p || !t) return alert('Заполните все поля!'); auth.createUserWithEmailAndPassword(m, p).then(c => db.collection('users').doc(c.user.uid).set({ name: n, phone: t, email: m, role: 'guest' })).then(() => { alert('Успешно!'); registerForm.reset(); showLoginLink.click(); }).catch(err => alert(`Ошибка: ${err.message}`)); }); }
    if (loginForm) { loginForm.addEventListener('submit', e => { e.preventDefault(); const m = loginEmailInput.value, p = loginPasswordInput.value; if (!m || !p) return alert('Введите email и пароль.'); auth.signInWithEmailAndPassword(m, p).catch(err => { if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) { alert('Неверный логин или пароль.'); } else { alert(`Ошибка: ${err.message}`); } }); }); }

    // =================================================================
    // ИСПРАВЛЕННАЯ ЛОГИКА НАВИГАЦИИ
    // =================================================================
    menuButtons.forEach(b => {
        b.addEventListener('click', () => {
            const targetScreenId = b.dataset.target;
            // Если мы кликаем на "Историю", сначала запускаем загрузку данных
            if (targetScreenId === 'history-screen') {
                renderHistory();
            }
            // Затем в любом случае показываем нужный экран
            showScreen(targetScreenId);
        });
    });
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    if (logoutBtn) { logoutBtn.addEventListener('click', e => { e.preventDefault(); auth.signOut().catch(err => alert(`Ошибка: ${err.message}`)); }); }

    // ЛОГИКА "НАЧАТЬ СОТРУДНИЧЕСТВО"
    function renderCityButtons() { if (!cityListContainer) return; const cities = ["Павлодар", "Экибастуз", "Усть-Каменогорск"]; cityListContainer.innerHTML = ''; cities.forEach(city => { const button = document.createElement('button'); button.className = 'menu-btn'; button.textContent = city; button.addEventListener('click', () => renderLocationsForCity(city)); cityListContainer.appendChild(button); }); }
    function renderLocationsForCity(cityName) { if (!locationsListContainer || !locationsHeader) return; locationsHeader.textContent = `Точки в г. ${cityName}`; locationsListContainer.innerHTML = '<div class="spinner"></div>'; showScreen('locations-screen'); db.collection('locations').where('city', '==', cityName).get().then(snapshot => { locationsListContainer.innerHTML = ''; if (snapshot.empty) { locationsListContainer.innerHTML = '<p>Нет доступных точек.</p>'; return; } snapshot.forEach(doc => { const point = doc.data(); const li = document.createElement('li'); li.className = 'location-item'; li.innerHTML = `<strong>${point.name}</strong><small>${point.address}</small>`; li.addEventListener('click', () => openChecklistFor(point)); locationsListContainer.appendChild(li); }); }).catch(error => { console.error("Ошибка: ", error); locationsListContainer.innerHTML = '<p>Не удалось загрузить точки.</p>'; }); }

    // ЛОГИКА ЧЕК-ЛИСТА
    function openChecklistFor(pointData) { if (!checklistAddress || !checklistDate || !checklistForm) return; currentChecklistPoint = pointData; checklistAddress.textContent = pointData.address; checklistDate.textContent = new Date().toLocaleString('ru-RU'); checklistForm.reset(); showScreen('checklist-screen'); }
    if (checklistForm) { checklistForm.addEventListener('submit', e => { e.preventDefault(); const user = auth.currentUser; if (!user) return alert('Ошибка: вы не авторизованы.'); const reportData = { userId: user.uid, userEmail: user.email, pointName: currentChecklistPoint.name, pointAddress: currentChecklistPoint.address, checkDate: new Date(), status: 'pending', answers: { /* ... ответы ... */ } }; db.collection('reports').add(reportData).then(() => { alert('Спасибо за ваш отчёт ✅'); showScreen('main-menu-screen'); }).catch(error => { console.error("Ошибка: ", error); alert('Не удалось отправить отчет.'); }); }); }
    
    // =================================================================
    // НОВЫЙ КОД: ЛОГИКА ЭКРАНА "ИСТОРИЯ ПРОВЕРОК"
    // =================================================================
    function renderHistory() {
        if (!historyListContainer) return;
        const user = auth.currentUser;
        if (!user) return; // Если пользователя нет, ничего не делаем

        historyListContainer.innerHTML = '<div class="spinner"></div>'; // Показываем загрузку

        db.collection('reports').where('userId', '==', user.uid).orderBy('checkDate', 'desc').get()
            .then(snapshot => {
                historyListContainer.innerHTML = ''; // Очищаем от спиннера
                if (snapshot.empty) {
                    historyListContainer.innerHTML = '<p>Вы еще не отправили ни одного отчета.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    const report = doc.data();
                    const date = report.checkDate.toDate().toLocaleString('ru-RU');
                    
                    const li = document.createElement('li');
                    li.className = 'location-item';
                    li.innerHTML = `
                        <strong>${report.pointAddress}</strong>
                        <small>Дата: ${date} - Статус: ${report.status}</small>
                    `;
                    historyListContainer.appendChild(li);
                });
            })
            .catch(error => {
                console.error("Ошибка при загрузке истории: ", error);
                historyListContainer.innerHTML = '<p>Не удалось загрузить историю проверок.</p>';
            });
    }

    // ГЛАВНЫЙ КОНТРОЛЛЕР
    auth.onAuthStateChanged(user => {
        if (user) {
            showScreen('main-menu-screen');
            renderCityButtons();
        } else {
            showScreen('auth-screen');
        }
    });
});
