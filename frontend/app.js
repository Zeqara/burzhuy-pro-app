// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

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
    // DOM Элементы
    const loginView = document.getElementById('login-view'), registerView = document.getElementById('register-view'), loginForm = document.getElementById('login-form'), registerForm = document.getElementById('register-form'), showRegisterLink = document.getElementById('show-register'), showLoginLink = document.getElementById('show-login'), loginEmailInput = document.getElementById('login-email'), loginPasswordInput = document.getElementById('login-password'), registerNameInput = document.getElementById('register-name'), registerEmailInput = document.getElementById('register-email'), registerPasswordInput = document.getElementById('register-password'), registerPhoneInput = document.getElementById('register-phone');
    const logoutBtn = document.getElementById('logout-btn'), menuButtons = document.querySelectorAll('.menu-btn'), backButtons = document.querySelectorAll('.back-btn');
    const cityListContainer = document.getElementById('city-list'), locationsListContainer = document.getElementById('locations-list'), locationsHeader = document.getElementById('locations-header');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');
    const historyListContainer = document.getElementById('history-list');
    const adminMenuContainer = document.getElementById('admin-menu-container');
    const adminReportsList = document.getElementById('admin-reports-list');
    const adminDetailAddress = document.getElementById('admin-detail-address'), adminDetailUser = document.getElementById('admin-detail-user'), adminDetailDate = document.getElementById('admin-detail-date'), adminDetailStatus = document.getElementById('admin-detail-status'), adminDetailPhotos = document.getElementById('admin-detail-photos');
    const adminDetailAnswers = { q1: document.getElementById('admin-detail-q1'), q2: document.getElementById('admin-detail-q2'), q3: document.getElementById('admin-detail-q3'), q4: document.getElementById('admin-detail-q4'), q5: document.getElementById('admin-detail-q5'), q6: document.getElementById('admin-detail-q6'), q7: document.getElementById('admin-detail-q7'), q8: document.getElementById('admin-detail-q8'), q9: document.getElementById('admin-detail-q9'), };
    const approveBtn = document.getElementById('admin-action-approve');
    const rejectBtn = document.getElementById('admin-action-reject');
    let currentChecklistPoint = null;
    let currentUserRole = 'guest';
    let currentReportId = null;

    // ЛОГИКА АВТОРИЗАЦИИ
    if (showRegisterLink) { showRegisterLink.addEventListener('click', e => { e.preventDefault(); loginView.style.display = 'none'; registerView.style.display = 'block'; }); }
    if (showLoginLink) { showLoginLink.addEventListener('click', e => { e.preventDefault(); registerView.style.display = 'none'; loginView.style.display = 'block'; }); }
    if (registerForm) { registerForm.addEventListener('submit', e => { e.preventDefault(); const n = registerNameInput.value, m = registerEmailInput.value, p = registerPasswordInput.value, t = registerPhoneInput.value; if (!n || !m || !p || !t) return alert('Заполните все поля!'); auth.createUserWithEmailAndPassword(m, p).then(c => db.collection('users').doc(c.user.uid).set({ name: n, phone: t, email: m, role: 'guest' })).then(() => { alert('Успешно!'); registerForm.reset(); showLoginLink.click(); }).catch(err => alert(`Ошибка: ${err.message}`)); }); }
    if (loginForm) { loginForm.addEventListener('submit', e => { e.preventDefault(); const m = loginEmailInput.value, p = loginPasswordInput.value; if (!m || !p) return alert('Введите email и пароль.'); auth.signInWithEmailAndPassword(m, p).catch(err => { if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code)) { alert('Неверный логин или пароль.'); } else { alert(`Ошибка: ${err.message}`); } }); }); }

    // ЛОГИКА НАВИГАЦИИ
    menuButtons.forEach(b => { b.addEventListener('click', () => { const id = b.dataset.target; if (id === 'history-screen') renderHistory(); showScreen(id); }); });
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    if (logoutBtn) { logoutBtn.addEventListener('click', e => { e.preventDefault(); auth.signOut().catch(err => alert(`Ошибка: ${err.message}`)); }); }

    // ЛОГИКА СОТРУДНИЧЕСТВА
    function renderCityButtons() { if (!cityListContainer) return; const cities = ["Павлодар", "Экибастуз", "Усть-Каменогорск"]; cityListContainer.innerHTML = ''; cities.forEach(city => { const button = document.createElement('button'); button.className = 'menu-btn'; button.textContent = city; button.addEventListener('click', () => renderLocationsForCity(city)); cityListContainer.appendChild(button); }); }
    function renderLocationsForCity(cityName) { if (!locationsListContainer || !locationsHeader) return; locationsHeader.textContent = `Точки в г. ${cityName}`; locationsListContainer.innerHTML = '<div class="spinner"></div>'; showScreen('locations-screen'); db.collection('locations').where('city', '==', cityName).get().then(snap => { locationsListContainer.innerHTML = ''; if (snap.empty) { locationsListContainer.innerHTML = '<p>Нет доступных точек.</p>'; return; } snap.forEach(doc => { const point = doc.data(); const li = document.createElement('li'); li.className = 'location-item'; li.innerHTML = `<strong>${point.name}</strong><small>${point.address}</small>`; li.addEventListener('click', () => openChecklistFor(point)); locationsListContainer.appendChild(li); }); }).catch(err => { console.error(err); locationsListContainer.innerHTML = '<p>Не удалось загрузить точки.</p>'; }); }

    // ЛОГИКА ЧЕК-ЛИСТА
    function openChecklistFor(pointData) { if (!checklistForm) return; currentChecklistPoint = pointData; checklistAddress.textContent = pointData.address; checklistDate.textContent = new Date().toLocaleString('ru-RU'); checklistForm.reset(); showScreen('checklist-screen'); }
    if (checklistForm) { checklistForm.addEventListener('submit', async e => { e.preventDefault(); const user = auth.currentUser; if (!user) return alert('Ошибка: вы не авторизованы.'); const submitButton = checklistForm.querySelector('button[type="submit"]'); submitButton.disabled = true; submitButton.textContent = 'Отправка...'; const photoFiles = document.getElementById('checklist-photos').files; const uploadPromises = []; for (const file of photoFiles) { const filePath = `reports/${user.uid}/${Date.now()}_${file.name}`; const fileRef = storage.ref(filePath); uploadPromises.push(fileRef.put(file).then(() => fileRef.getDownloadURL())); } try { const imageUrls = await Promise.all(uploadPromises); const reportData = { userId: user.uid, userEmail: user.email, pointName: currentChecklistPoint.name, pointAddress: currentChecklistPoint.address, checkDate: new Date(), status: 'pending', imageUrls: imageUrls, answers: { q1_appearance: document.getElementById('checklist-q1-appearance').value, q2_cleanliness: document.getElementById('checklist-q2-cleanliness').value, q3_greeting: document.getElementById('checklist-q3-greeting').value, q4_upsell: document.getElementById('checklist-q4-upsell').value, q5_actions: document.getElementById('checklist-q5-actions').value, q6_handout: document.getElementById('checklist-q6-handout').value, q7_order_eval: document.getElementById('checklist-q7-order-eval').value, q8_food_rating: document.getElementById('checklist-q8-food-rating').value, q9_comments: document.getElementById('checklist-q9-comments').value, } }; await db.collection('reports').add(reportData); alert('Спасибо за ваш отчёт ✅'); showScreen('main-menu-screen'); } catch (error) { console.error("Ошибка: ", error); alert('Не удалось отправить отчет.'); } finally { submitButton.disabled = false; submitButton.textContent = 'Отправить отчёт'; } }); }
    
    // ЛОГИКА ИСТОРИИ
    function renderHistory() { if (!historyListContainer) return; const user = auth.currentUser; if (!user) return; historyListContainer.innerHTML = '<div class="spinner"></div>'; db.collection('reports').where('userId', '==', user.uid).orderBy('checkDate', 'desc').get().then(snap => { historyListContainer.innerHTML = ''; if (snap.empty) { historyListContainer.innerHTML = '<p>Вы еще не отправили ни одного отчета.</p>'; return; } snap.forEach(doc => { const report = doc.data(); const date = report.checkDate.toDate().toLocaleString('ru-RU'); const statusText = report.status === 'pending' ? 'в ожидании' : report.status === 'approved' ? 'принят' : report.status === 'rejected' ? 'отклонен' : report.status; const li = document.createElement('li'); li.className = 'location-item'; li.innerHTML = `<strong>${report.pointAddress}</strong><small>Дата: ${date} - Статус: ${statusText}</small>`; historyListContainer.appendChild(li); }); }).catch(err => { console.error(err); historyListContainer.innerHTML = '<p>Не удалось загрузить историю.</p>'; }); }
    
    // ЛОГИКА АДМИНКИ
    function setupAdminButton() { if (!adminMenuContainer) return; adminMenuContainer.innerHTML = ''; if (currentUserRole === 'admin') { const btn = document.createElement('button'); btn.className = 'menu-btn'; btn.textContent = 'Админ-панель'; btn.addEventListener('click', () => { renderAllReports(); showScreen('admin-screen'); }); adminMenuContainer.appendChild(btn); } }
    function renderAllReports() { if (!adminReportsList) return; adminReportsList.innerHTML = '<div class="spinner"></div>'; db.collection('reports').orderBy('checkDate', 'desc').get().then(snap => { adminReportsList.innerHTML = ''; if (snap.empty) { adminReportsList.innerHTML = '<p>Пока нет ни одного отчета.</p>'; return; } snap.forEach(doc => { const report = doc.data(); const date = report.checkDate.toDate().toLocaleString('ru-RU'); const statusText = report.status === 'pending' ? 'в ожидании' : report.status === 'approved' ? 'принят' : report.status === 'rejected' ? 'отклонен' : report.status; const li = document.createElement('li'); li.className = 'location-item'; li.innerHTML = `<strong>${report.pointAddress}</strong><small>Пользователь: ${report.userEmail}</small><small>Дата: ${date} - Статус: ${statusText}</small>`; li.addEventListener('click', () => openAdminReportDetail(doc.id)); adminReportsList.appendChild(li); }); }).catch(err => { console.error(err); adminReportsList.innerHTML = '<p>Не удалось загрузить отчеты.</p>'; }); }
    function openAdminReportDetail(reportId) { showScreen('admin-report-detail-screen'); currentReportId = reportId; const detailsContainer = document.querySelector('#admin-report-detail-screen .report-details'); detailsContainer.style.opacity = '0.5'; db.collection('reports').doc(reportId).get().then(doc => { if (!doc.exists) { alert('Ошибка: отчет не найден!'); return; } const report = doc.data(); const statusText = report.status === 'pending' ? 'в ожидании' : report.status === 'approved' ? 'принят' : report.status === 'rejected' ? 'отклонен' : report.status; adminDetailAddress.textContent = report.pointAddress; adminDetailUser.textContent = report.userEmail; adminDetailDate.textContent = report.checkDate.toDate().toLocaleString('ru-RU'); adminDetailStatus.textContent = statusText; adminDetailAnswers.q1.textContent = report.answers.q1_appearance; adminDetailAnswers.q2.textContent = report.answers.q2_cleanliness; adminDetailAnswers.q3.textContent = report.answers.q3_greeting; adminDetailAnswers.q4.textContent = report.answers.q4_upsell; adminDetailAnswers.q5.textContent = report.answers.q5_actions; adminDetailAnswers.q6.textContent = report.answers.q6_handout; adminDetailAnswers.q7.textContent = report.answers.q7_order_eval; adminDetailAnswers.q8.textContent = report.answers.q8_food_rating; adminDetailAnswers.q9.textContent = report.answers.q9_comments || '—'; adminDetailPhotos.innerHTML = ''; if (report.imageUrls && report.imageUrls.length > 0) { report.imageUrls.forEach(url => { const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.innerHTML = `<img src="${url}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">`; adminDetailPhotos.appendChild(link); }); } else { adminDetailPhotos.innerHTML = '<p>Фотографии не были прикреплены.</p>'; } }).catch(error => { console.error("Ошибка:", error); alert("Не удалось загрузить детали отчета."); }).finally(() => { detailsContainer.style.opacity = '1'; }); }
    
    // НОВАЯ ЛОГИКА ДЛЯ КНОПОК
    if (approveBtn) { approveBtn.addEventListener('click', () => updateReportStatus(currentReportId, 'approved')); }
    if (rejectBtn) { rejectBtn.addEventListener('click', () => updateReportStatus(currentReportId, 'rejected')); }
    
    function updateReportStatus(reportId, newStatus) {
        if (!reportId) return;
        db.collection('reports').doc(reportId).update({ status: newStatus })
            .then(() => {
                alert(`Статус отчета изменен на "${newStatus}"`);
                renderAllReports(); // Обновляем список отчетов
                showScreen('admin-screen'); // Возвращаемся к списку
            })
            .catch(error => {
                console.error("Ошибка при обновлении статуса: ", error);
                alert("Не удалось изменить статус отчета.");
            });
    }

    // ГЛАВНЫЙ КОНТРОЛЛЕР
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                currentUserRole = doc.exists ? doc.data().role : 'guest';
                showScreen('main-menu-screen');
                renderCityButtons();
                setupAdminButton();
            });
        } else {
            currentUserRole = 'guest';
            showScreen('auth-screen');
            setupAdminButton();
        }
    });
});
