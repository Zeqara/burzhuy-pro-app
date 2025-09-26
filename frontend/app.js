// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage(); // <-- НОВЫЙ СЕРВИС

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: НАВИГАЦИЯ
// =================================================================
function showScreen(screenId) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); const targetScreen = document.getElementById(screenId); if (targetScreen) targetScreen.classList.add('active'); }

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ВСЕГО ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // ... (старый код получения элементов остается таким же)
    const loginView = document.getElementById('login-view'), registerView = document.getElementById('register-view'), loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form'), showRegisterLink = document.getElementById('show-register'), showLoginLink = document.getElementById('show-login'), loginEmailInput = document.getElementById('login-email'), loginPasswordInput = document.getElementById('login-password'), registerNameInput = document.getElementById('register-name'), registerEmailInput = document.getElementById('register-email'), registerPasswordInput = document.getElementById('register-password'), registerPhoneInput = document.getElementById('register-phone');
    const logoutBtn = document.getElementById('logout-btn'), menuButtons = document.querySelectorAll('.menu-btn'), backButtons = document.querySelectorAll('.back-btn');
    const cityListContainer = document.getElementById('city-list'), locationsListContainer = document.getElementById('locations-list'), locationsHeader = document.getElementById('locations-header');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');
    const historyListContainer = document.getElementById('history-list');
    let currentChecklistPoint = null;

    // ... (весь код авторизации и навигации остается без изменений)
    if (showRegisterLink) { showRegisterLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; }); }
    if (showLoginLink) { showLoginLink.addEventListener('click', e => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; }); }
    if (registerForm) { registerForm.addEventListener('submit', e => { e.preventDefault(); const n = registerNameInput.value, m = registerEmailInput.value, p = registerPasswordInput.value, t = registerPhoneInput.value; if (!n || !m || !p || !t) return alert('Заполните все поля!'); auth.createUserWithEmailAndPassword(m, p).then(c => db.collection('users').doc(c.user.uid).set({ name: n, phone: t, email: m, role: 'guest' })).then(() => { alert('Успешно!'); registerForm.reset(); showLoginLink.click(); }).catch(err => alert(`Ошибка: ${err.message}`)); }); }
    if (loginForm) { loginForm.addEventListener('submit', e => { e.preventDefault(); const m = loginEmailInput.value, p = loginPasswordInput.value; if (!m || !p) return alert('Введите email и пароль.'); auth.signInWithEmailAndPassword(m, p).catch(err => { if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) { alert('Неверный логин или пароль.'); } else { alert(`Ошибка: ${err.message}`); } }); }); }
    menuButtons.forEach(b => { b.addEventListener('click', () => { const targetScreenId = b.dataset.target; if (targetScreenId === 'history-screen') { renderHistory(); } showScreen(targetScreenId); }); });
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    if (logoutBtn) { logoutBtn.addEventListener('click', e => { e.preventDefault(); auth.signOut().catch(err => alert(`Ошибка: ${err.message}`)); }); }
    function renderCityButtons() { if (!cityListContainer) return; const cities = ["Павлодар", "Экибастуз", "Усть-Каменогорск"]; cityListContainer.innerHTML = ''; cities.forEach(city => { const button = document.createElement('button'); button.className = 'menu-btn'; button.textContent = city; button.addEventListener('click', () => renderLocationsForCity(city)); cityListContainer.appendChild(button); }); }
    function renderLocationsForCity(cityName) { if (!locationsListContainer || !locationsHeader) return; locationsHeader.textContent = `Точки в г. ${cityName}`; locationsListContainer.innerHTML = '<div class="spinner"></div>'; showScreen('locations-screen'); db.collection('locations').where('city', '==', cityName).get().then(snapshot => { locationsListContainer.innerHTML = ''; if (snapshot.empty) { locationsListContainer.innerHTML = '<p>Нет доступных точек.</p>'; return; } snapshot.forEach(doc => { const point = doc.data(); const li = document.createElement('li'); li.className = 'location-item'; li.innerHTML = `<strong>${point.name}</strong><small>${point.address}</small>`; li.addEventListener('click', () => openChecklistFor(point)); locationsListContainer.appendChild(li); }); }).catch(error => { console.error("Ошибка: ", error); locationsListContainer.innerHTML = '<p>Не удалось загрузить точки.</p>'; }); }
    
    // =================================================================
    // ОБНОВЛЕННАЯ ЛОГИКА ЧЕК-ЛИСТА С ЗАГРУЗКОЙ ФОТО
    // =================================================================
    function openChecklistFor(pointData) { if (!checklistAddress || !checklistDate || !checklistForm) return; currentChecklistPoint = pointData; checklistAddress.textContent = pointData.address; checklistDate.textContent = new Date().toLocaleString('ru-RU'); checklistForm.reset(); showScreen('checklist-screen'); }
    
    if (checklistForm) {
        checklistForm.addEventListener('submit', async (e) => { // <-- делаем функцию асинхронной
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return alert('Ошибка: вы не авторизованы.');

            const submitButton = checklistForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Отправка...';

            // 1. Загружаем фотографии
            const photoFiles = document.getElementById('checklist-photos').files;
            const uploadPromises = [];
            for (const file of photoFiles) {
                const filePath = `reports/${user.uid}/${Date.now()}_${file.name}`;
                const fileRef = storage.ref(filePath);
                uploadPromises.push(fileRef.put(file).then(() => fileRef.getDownloadURL()));
            }

            try {
                const imageUrls = await Promise.all(uploadPromises); // Ждем завершения всех загрузок

                // 2. Собираем данные отчета
                const reportData = {
                    userId: user.uid, userEmail: user.email,
                    pointName: currentChecklistPoint.name, pointAddress: currentChecklistPoint.address,
                    checkDate: new Date(),
                    status: 'pending',
                    imageUrls: imageUrls, // <-- Добавляем ссылки на фото
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
                };
                
                // 3. Сохраняем отчет в Firestore
                await db.collection('reports').add(reportData);
                
                alert('Спасибо за ваш отчёт ✅');
                showScreen('main-menu-screen');

            } catch (error) {
                console.error("Ошибка при отправке отчета: ", error);
                alert('Не удалось отправить отчет. Пожалуйста, попробуйте еще раз.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Отправить отчёт';
            }
        });
    }

    // ... (код для renderHistory и auth.onAuthStateChanged остается без изменений)
    function renderHistory() { if (!historyListContainer) return; const user = auth.currentUser; if (!user) return; historyListContainer.innerHTML = '<div class="spinner"></div>'; db.collection('reports').where('userId', '==', user.uid).orderBy('checkDate', 'desc').get() .then(snapshot => { historyListContainer.innerHTML = ''; if (snapshot.empty) { historyListContainer.innerHTML = '<p>Вы еще не отправили ни одного отчета.</p>'; return; } snapshot.forEach(doc => { const report = doc.data(); const date = report.checkDate.toDate().toLocaleString('ru-RU'); const statusText = report.status === 'pending' ? 'в ожидании' : report.status; const li = document.createElement('li'); li.className = 'location-item'; li.innerHTML = `<strong>${report.pointAddress}</strong><small>Дата: ${date} - Статус: ${statusText}</small>`; historyListContainer.appendChild(li); }); }) .catch(error => { console.error("Ошибка при загрузке истории: ", error); historyListContainer.innerHTML = '<p>Не удалось загрузить историю проверок.</p>'; }); }
    auth.onAuthStateChanged(user => { if (user) { showScreen('main-menu-screen'); renderCityButtons(); } else { showScreen('auth-screen'); } });
});
