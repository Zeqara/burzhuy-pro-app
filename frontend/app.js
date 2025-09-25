// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// =================================================================
// ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ (DOM)
// =================================================================
// Авторизация
const loginView = document.getElementById('login-view'), registerView = document.getElementById('register-view'), loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form'), showRegisterLink = document.getElementById('show-register'), showLoginLink = document.getElementById('show-login'), loginEmailInput = document.getElementById('login-email'), loginPasswordInput = document.getElementById('login-password'), registerNameInput = document.getElementById('register-name'), registerEmailInput = document.getElementById('register-email'), registerPasswordInput = document.getElementById('register-password'), registerPhoneInput = document.getElementById('register-phone');
// Навигация
const logoutBtn = document.getElementById('logout-btn'), menuButtons = document.querySelectorAll('.menu-btn'), backButtons = document.querySelectorAll('.back-btn');
// Экраны сотрудничества
const cityListContainer = document.getElementById('city-list'), locationsListContainer = document.getElementById('locations-list'), locationsHeader = document.getElementById('locations-header');
// Чек-лист
const checklistForm = document.getElementById('checklist-form');
const checklistAddress = document.getElementById('checklist-address');
const checklistDate = document.getElementById('checklist-date');
let currentChecklistPoint = null; // Переменная для хранения данных о выбранной точке

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ НАВИГАЦИИ
// =================================================================
function showScreen(screenId) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); const targetScreen = document.getElementById(screenId); if (targetScreen) targetScreen.classList.add('active'); }

// =================================================================
// ЛОГИКА АВТОРИЗАЦИИ (без изменений)
// =================================================================
showRegisterLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; });
showLoginLink.addEventListener('click', e => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; });
registerForm.addEventListener('submit', e => { e.preventDefault(); const name = registerNameInput.value, email = registerEmailInput.value, password = registerPasswordInput.value, phone = registerPhoneInput.value; if (!name || !email || !password || !phone) return alert('Пожалуйста, заполните все поля!'); auth.createUserWithEmailAndPassword(email, password).then(cred => db.collection('users').doc(cred.user.uid).set({ name, phone, email, role: 'guest' })).then(() => { alert('Регистрация прошла успешно!'); registerForm.reset(); showLoginLink.click(); }).catch(err => alert(`Ошибка: ${err.message}`)); });
loginForm.addEventListener('submit', e => { e.preventDefault(); const email = loginEmailInput.value, password = loginPasswordInput.value; if (!email || !password) return alert('Введите email и пароль.'); auth.signInWithEmailAndPassword(email, password).catch(err => { if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) { alert('Неверный логин или пароль.'); } else { alert(`Ошибка: ${err.message}`); } }); });

// =================================================================
// ЛОГИКА НАВИГАЦИИ (без изменений)
// =================================================================
menuButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
logoutBtn.addEventListener('click', e => { e.preventDefault(); auth.signOut().catch(err => alert(`Ошибка: ${err.message}`)); });

// =================================================================
// ЛОГИКА ЭКРАНА "НАЧАТЬ СОТРУДНИЧЕСТВО" (с изменениями)
// =================================================================
function renderCityButtons() { const cities = ["Павлодар", "Экибастуз", "Усть-Каменогорск"]; cityListContainer.innerHTML = ''; cities.forEach(city => { const button = document.createElement('button'); button.className = 'menu-btn'; button.textContent = city; button.addEventListener('click', () => renderLocationsForCity(city)); cityListContainer.appendChild(button); }); }
function renderLocationsForCity(cityName) { locationsHeader.textContent = `Точки в г. ${cityName}`; locationsListContainer.innerHTML = '<div class="spinner"></div>'; showScreen('locations-screen'); db.collection('trading_points').where('city', '==', cityName).get().then(snapshot => { locationsListContainer.innerHTML = ''; if (snapshot.empty) { locationsListContainer.innerHTML = '<p>Нет доступных точек.</p>'; return; } snapshot.forEach(doc => { const point = doc.data(); const li = document.createElement('li'); li.className = 'location-item'; li.innerHTML = `<strong>${point.name}</strong><small>${point.address}</small>`; li.addEventListener('click', () => openChecklistFor(point)); // <-- ИЗМЕНЕНИЕ ЗДЕСЬ locationsListContainer.appendChild(li); }); }).catch(error => { console.error("Ошибка: ", error); locationsListContainer.innerHTML = '<p>Не удалось загрузить точки.</p>'; }); }

// =================================================================
// НОВЫЙ КОД: ЛОГИКА ЧЕК-ЛИСТА
// =================================================================
// Открывает экран чек-листа и заполняет его данными
function openChecklistFor(pointData) {
    currentChecklistPoint = pointData; // Сохраняем инфо о точке
    checklistAddress.textContent = pointData.address;
    checklistDate.textContent = new Date().toLocaleString('ru-RU');
    checklistForm.reset(); // Очищаем форму от старых данных
    showScreen('checklist-screen');
}

// Обработка отправки формы чек-листа
checklistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return alert('Ошибка: вы не авторизованы.');

    // Собираем все данные из формы в один объект
    const reportData = {
        userId: user.uid,
        userEmail: user.email,
        pointName: currentChecklistPoint.name,
        pointAddress: currentChecklistPoint.address,
        checkDate: new Date(),
        answers: {
            q1_appearance: document.getElementById('checklist-q1-appearance').value,
            q2_cleanliness: document.getElementById('checklist-q2-cleanliness').value,
            q3_greeting: document.getElementById('checklist-q3-greeting').value,
            q4_upsell: document.getElementById('checklist-q4-upsell').value,
            q5_actions: document.getElementById('checklist-q5-actions').value,
            q6_handout: document.getElementById('checklist-q6-handout').value,
            q7_order_eval: document.getElementById('checklist-q7-order-eval').value,
            q8_food_rating: document.getElementById('checklist-q8-food-rating').value,
            q9_comments: document.getElementById('checklist-q9-comments').value,
        }
        // TODO: Добавить ссылки на загруженные фото
    };
    
    // Сохраняем отчет в базу данных в новую коллекцию 'reports'
    db.collection('reports').add(reportData)
        .then(() => {
            alert('Спасибо за ваш отчёт ✅ На проверку отчёта уходит до 12 часов (будние дни).');
            showScreen('main-menu-screen'); // Возвращаем на главный экран
        })
        .catch(error => {
            console.error("Ошибка при отправке отчета: ", error);
            alert('Не удалось отправить отчет. Пожалуйста, попробуйте еще раз.');
        });
});

// =================================================================
// ГЛАВНЫЙ КОНТРОЛЛЕР (с изменениями)
// =================================================================
auth.onAuthStateChanged(user => {
    if (user) {
        showScreen('main-menu-screen');
        renderCityButtons(); // Генерируем кнопки городов после входа
    } else {
        showScreen('auth-screen');
    }
});```
