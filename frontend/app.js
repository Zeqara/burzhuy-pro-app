// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.firebasestorage.app", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let confirmationResult = null;
let currentCheckData = null;
let currentReportId = null;
let selectedScheduleForBooking = null;

// =================================================================
// ГЛАВНЫЕ ФУНКЦИИ
// =================================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
}

function showModal(title, text, type = 'alert', onConfirm = () => {}) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    modalTitle.textContent = title;
    modalText.innerHTML = text;
    modalConfirmBtn.textContent = 'OK';
    modalCancelBtn.style.display = (type === 'confirm') ? 'inline-block' : 'none';
    if (type === 'confirm') modalConfirmBtn.textContent = 'Подтвердить';
    modalContainer.classList.remove('modal-hidden');
    const confirmHandler = () => { onConfirm(true); modalContainer.classList.add('modal-hidden'); cleanup(); };
    const cancelHandler = () => { onConfirm(false); modalContainer.classList.add('modal-hidden'); cleanup(); };
    const cleanup = () => {
        modalConfirmBtn.removeEventListener('click', confirmHandler);
        modalCancelBtn.removeEventListener('click', cancelHandler);
    };
    modalConfirmBtn.addEventListener('click', confirmHandler);
    modalCancelBtn.addEventListener('click', cancelHandler);
}

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ВСЕГО ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // DOM Элементы
    const phoneForm = document.getElementById('phone-form'), codeForm = document.getElementById('code-form'), profileSetupForm = document.getElementById('profile-setup-form');
    const phoneInput = document.getElementById('phone-input'), codeInput = document.getElementById('code-input'), profileNameInput = document.getElementById('profile-name-input');
    const sendCodeBtn = document.getElementById('send-code-btn');
    const phoneView = document.getElementById('phone-view'), codeView = document.getElementById('code-view');
    const userNameDisplay = document.getElementById('user-name-display'), logoutBtn = document.getElementById('logout-btn');
    const adminMenuBtn = document.getElementById('admin-menu-btn');
    const scheduleForm = document.getElementById('schedule-form'), scheduleCitySelect = document.getElementById('schedule-city-select'), scheduleLocationSelect = document.getElementById('schedule-location-select'), scheduleDateInput = document.getElementById('schedule-date-input'), scheduleStartTimeInput = document.getElementById('schedule-start-time'), scheduleEndTimeInput = document.getElementById('schedule-end-time'), scheduleUrgentCheckbox = document.getElementById('schedule-urgent-checkbox'), scheduleList = document.getElementById('schedule-list'), viewScheduleBtn = document.getElementById('view-schedule-btn');
    const scheduleCardsList = document.getElementById('schedule-cards-list'), noSchedulesView = document.getElementById('no-schedules-view');
    const timePickerForm = document.getElementById('time-picker-form'), pickerLocationTitle = document.getElementById('picker-location-title'), userChosenTimeInput = document.getElementById('user-chosen-time');
    const dashboardInfoContainer = document.getElementById('dashboard-info-container');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');
    const historyList = document.getElementById('history-list');
    const adminReportsList = document.getElementById('admin-reports-list'), adminUsersList = document.getElementById('admin-users-list');
    const adminDetailAddress = document.getElementById('admin-detail-address'), adminDetailUser = document.getElementById('admin-detail-user'), adminDetailPhone = document.getElementById('admin-detail-phone'), adminDetailDate = document.getElementById('admin-detail-date'), adminDetailStatus = document.getElementById('admin-detail-status'), adminDetailPhotos = document.getElementById('admin-detail-photos'), adminDetailRejectionComment = document.getElementById('admin-detail-rejection-comment-container');
    const adminDetailAnswers = { q1: document.getElementById('admin-detail-q1'), q2: document.getElementById('admin-detail-q2'), q3: document.getElementById('admin-detail-q3'), q4: document.getElementById('admin-detail-q4'), q5: document.getElementById('admin-detail-q5'), q6: document.getElementById('admin-detail-q6'), q7: document.getElementById('admin-detail-q7'), q8: document.getElementById('admin-detail-q8'), q9: document.getElementById('admin-detail-q9'), };
    
    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });
    if (phoneInput) { phoneInput.addEventListener('input', () => { if (!phoneInput.value.startsWith('+7')) { phoneInput.value = '+7'; } }); }

    // --- АУТЕНТИФИКАЦИЯ ---
    if(phoneForm) phoneForm.addEventListener('submit', (e) => { e.preventDefault(); let rawPhoneNumber = phoneInput.value, digitsOnly = rawPhoneNumber.replace(/\D/g, ''); if (digitsOnly.startsWith('8')) digitsOnly = '7' + digitsOnly.substring(1); const formattedPhoneNumber = `+${digitsOnly}`; if (digitsOnly.length < 11) return showModal('Ошибка', 'Пожалуйста, введите полный номер телефона.'); sendCodeBtn.disabled = true; sendCodeBtn.textContent = 'Отправка...'; recaptchaVerifier.render().then((widgetId) => { auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier).then(result => { confirmationResult = result; phoneView.style.display = 'none'; codeView.style.display = 'block'; showModal('Успешно', 'СМС-код отправлен на ваш номер.'); }).catch(err => { console.error("Ошибка Firebase Auth:", err); showModal('Ошибка', `Произошла ошибка: ${err.code}`); }).finally(() => { sendCodeBtn.disabled = false; sendCodeBtn.textContent = 'Получить код'; }); }).catch(err => { console.error("Ошибка отрисовки reCAPTCHA:", err); showModal('Ошибка', 'Не удалось запустить проверку reCAPTCHA. Попробуйте обновить страницу.'); sendCodeBtn.disabled = false; sendCodeBtn.textContent = 'Получить код'; }); });
    if(codeForm) codeForm.addEventListener('submit', (e) => { e.preventDefault(); const code = codeInput.value; const confirmBtn = codeForm.querySelector('button[type="submit"]'); if (!code || !confirmationResult) return; confirmBtn.disabled = true; confirmBtn.textContent = 'Проверка...'; confirmationResult.confirm(code).catch(err => { showModal('Ошибка', 'Неверный код. Попробуйте еще раз.'); confirmBtn.disabled = false; confirmBtn.textContent = 'Войти'; }); });
    if(profileSetupForm) profileSetupForm.addEventListener('submit', (e) => { e.preventDefault(); const user = auth.currentUser, fullName = profileNameInput.value.trim(); if (!user || !fullName) return; db.collection('users').doc(user.uid).set({ fullName, phone: user.phoneNumber, role: 'guest' }).then(() => { userNameDisplay.textContent = fullName; showScreen('main-menu-screen'); }).catch(err => showModal('Ошибка', 'Не удалось сохранить профиль.')); });

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    userNameDisplay.textContent = userData.fullName;
                    if (adminMenuBtn) adminMenuBtn.style.display = (userData.role === 'admin') ? 'flex' : 'none';
                    if (userData.role === 'admin') loadAdminStats();
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else { showScreen('profile-setup-screen'); }
            }).catch(err => { console.error("Ошибка получения профиля:", err); showModal('Критическая ошибка', 'Не удалось загрузить данные профиля. Пожалуйста, обновите страницу.'); });
        } else {
            if (adminMenuBtn) adminMenuBtn.style.display = 'none';
            if (phoneView && codeView) { phoneView.style.display = 'block'; codeView.style.display = 'none'; }
            showScreen('auth-screen');
        }
    });
    
    if(logoutBtn) logoutBtn.addEventListener('click', () => { auth.signOut(); });

    // --- ЛОГИКА АДМИН-ПАНЕЛИ ---
    if (adminMenuBtn) adminMenuBtn.addEventListener('click', () => showScreen('admin-hub-screen'));
    async function loadAdminStats() { const statsContainer = document.getElementById('admin-stats-container'); if (!statsContainer) return; try { const pendingReports = await db.collection('reports').where('status', '==', 'pending').get(); const totalUsers = await db.collection('users').get(); statsContainer.innerHTML = `<div class="stat-card"><h3>${pendingReports.size}</h3><p>Отчетов на проверке</p></div><div class="stat-card"><h3>${totalUsers.size}</h3><p>Всего пользователей</p></div>`; } catch(e) { console.error("Ошибка загрузки статистики:", e)} }
    async function loadCitiesForAdmin() { if (!scheduleCitySelect) return; const snapshot = await db.collection('cities').orderBy('name').get(); let optionsHTML = '<option value="" disabled selected>-- Выберите город --</option>'; snapshot.forEach(doc => { optionsHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; }); scheduleCitySelect.innerHTML = optionsHTML; }
    if (scheduleCitySelect) { scheduleCitySelect.addEventListener('change', async (e) => { const selectedCity = e.target.value; scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- Загрузка... --</option>'; if (!selectedCity) { scheduleLocationSelect.disabled = true; return; } const snapshot = await db.collection('locations').where('city', '==', selectedCity).get(); let optionsHTML = '<option value="" disabled selected>-- Выберите точку --</option>'; snapshot.forEach(doc => { const loc = doc.data(); const cleanName = loc.name.replace(/^Б\d+\s*/, ''); optionsHTML += `<option value="${doc.id}" data-name="${loc.name}" data-address="${loc.address}">${cleanName}</option>`; }); scheduleLocationSelect.innerHTML = optionsHTML; scheduleLocationSelect.disabled = false; }); }
    if (scheduleForm) scheduleForm.addEventListener('submit', async (e) => { e.preventDefault(); const city = scheduleCitySelect.value; const selOpt = scheduleLocationSelect.options[scheduleLocationSelect.selectedIndex]; const locationId = selOpt.value, locationName = selOpt.dataset.name, locationAddress = selOpt.dataset.address, date = scheduleDateInput.value, isUrgent = scheduleUrgentCheckbox.checked; const startTime = scheduleStartTimeInput.value, endTime = scheduleEndTimeInput.value; if (!city || !locationId || !date || !startTime || !endTime) return showModal('Ошибка', 'Заполните все поля.'); await db.collection('schedule').add({ city, locationId, locationName, locationAddress, date: new Date(date), isUrgent, startTime, endTime }); showModal('Успешно', 'Проверка добавлена в график!'); scheduleForm.reset(); scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- ... --</option>'; scheduleLocationSelect.disabled = true; });
    async function renderSchedules() { if (!scheduleList) return; scheduleList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('schedule').orderBy('date', 'desc').get(); if (snapshot.empty) { scheduleList.innerHTML = '<p>Запланированных проверок нет.</p>'; return; } let listHTML = ''; snapshot.forEach(doc => { const s = doc.data(); const date = s.date.toDate().toLocaleDateString('ru-RU'); listHTML += `<div class="schedule-item ${s.isUrgent ? 'urgent' : ''}"><div><strong>${s.city ? s.city + ': ' : ''}${s.locationName.replace(/^Б\d+\s*/, '')}</strong><small>${date} (${s.startTime} - ${s.endTime}) ${s.isUrgent ? '🔥' : ''}</small></div><button class="delete-schedule-btn" data-id="${doc.id}">Удалить</button></div>`; }); scheduleList.innerHTML = listHTML; document.querySelectorAll('.delete-schedule-btn').forEach(b => b.addEventListener('click', (e) => deleteSchedule(e.target.dataset.id))); }
    function deleteSchedule(scheduleId) { showModal('Удаление', 'Удалить эту проверку?', 'confirm', async (confirmed) => { if(confirmed) { try { await db.collection('schedule').doc(scheduleId).delete(); showModal('Успешно', 'Проверка удалена.'); renderSchedules(); } catch (error) { showModal('Ошибка', 'Не удалось удалить проверку.'); } } }); }
    async function renderAllReports() { if (!adminReportsList) return; adminReportsList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('reports').orderBy('createdAt', 'desc').get(); if (snapshot.empty) { adminReportsList.innerHTML = '<p>Отчетов пока нет.</p>'; return; } let html = ''; const userIds = [...new Set(snapshot.docs.map(doc => doc.data().userId))]; if (userIds.length > 0) { const userPromises = userIds.map(id => db.collection('users').doc(id).get()); const userDocs = await Promise.all(userPromises); const usersMap = new Map(userDocs.map(d => [d.id, d.data()])); snapshot.forEach(doc => { const r = doc.data(); const user = usersMap.get(r.userId); const date = r.checkDate && r.checkDate.toDate ? r.checkDate.toDate().toLocaleDateString('ru-RU') : 'без даты'; const statusText = { booked: 'забронирован', pending: 'в ожидании', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[r.status] || r.status; html += `<li class="menu-list-item report-item" data-id="${doc.id}"><div class="status-indicator ${r.status}"></div><div><strong>${r.locationName.replace(/^Б\d+\s*/, '')}</strong><small>${user?.fullName || 'Агент'} - ${date} - ${statusText}</small></div><button class="delete-report-btn" data-id="${doc.id}">Удалить</button></li>`; }); } adminReportsList.innerHTML = html; adminReportsList.querySelectorAll('.report-item').forEach(item => item.addEventListener('click', (e) => { if (e.target.classList.contains('delete-report-btn')) return; openAdminReportDetail(item.dataset.id); })); adminReportsList.querySelectorAll('.delete-report-btn').forEach(button => button.addEventListener('click', (e) => deleteReport(e.target.dataset.id))); }
    async function openAdminReportDetail(reportId) { /* ... */ }
    function updateReportStatus(newStatus) { /* ... */ }
    async function deleteReport(reportId) { /* ... */ }
    async function renderAllUsers() { if (!adminUsersList) return; adminUsersList.innerHTML = '<div class="spinner"></div>'; const usersSnapshot = await db.collection('users').get(); const reportsSnapshot = await db.collection('reports').where('status', 'in', ['approved', 'paid']).get(); const reportCounts = {}; reportsSnapshot.forEach(doc => { const userId = doc.data().userId; if (!reportCounts[userId]) reportCounts[userId] = 0; reportCounts[userId]++; }); if (usersSnapshot.empty) { adminUsersList.innerHTML = '<p>Пользователей нет.</p>'; return; } let html = ''; usersSnapshot.forEach(doc => { const u = doc.data(); const userId = doc.id; const completedChecks = reportCounts[userId] || 0; const roleText = u.role === 'admin' ? 'Разжаловать' : 'Сделать админом'; const roleClass = u.role === 'admin' ? 'admin' : ''; html += `<li class="user-card"><div class="user-card-header"><div class="user-card-avatar">${u.fullName ? u.fullName.charAt(0) : '?'}</div><div class="user-card-info"><strong>${u.fullName || 'Имя не указано'}</strong><small>${u.phone || 'Телефон не указан'}</small></div></div><div class="user-card-stats"><div><span>${completedChecks}</span><small>Проверок</small></div></div><div class="user-card-actions"><button class="role-toggle-btn ${roleClass}" data-id="${userId}" data-role="${u.role}" data-name="${u.fullName}">${roleText}</button><button class="delete-user-btn" data-id="${userId}" data-name="${u.fullName}">Удалить</button></div></li>`; }); adminUsersList.innerHTML = html; adminUsersList.querySelectorAll('.role-toggle-btn').forEach(button => button.addEventListener('click', (e) => toggleUserRole(e.currentTarget.dataset.id, e.currentTarget.dataset.role, e.currentTarget.dataset.name))); adminUsersList.querySelectorAll('.delete-user-btn').forEach(button => button.addEventListener('click', (e) => deleteUser(e.currentTarget.dataset.id, e.currentTarget.dataset.name))); }
    function toggleUserRole(userId, currentRole, name) { /* ... */ }
    function deleteUser(userId, name) { /* ... */ }

    // --- ЛОГИКА АГЕНТА ---
    async function renderAvailableSchedules() { /* ... */ }
    async function openTimePicker(scheduleId) { /* ... */ }
    if (timePickerForm) timePickerForm.addEventListener('submit', async (e) => { /* ... */ });
    async function loadUserDashboard(userId) { /* ... */ }
    async function cancelBooking(reportId) { /* ... */ }
    function openChecklist() { /* ... */ }
    if (checklistForm) checklistForm.addEventListener('submit', async (e) => { /* ... */ });
    async function renderHistory() { if (!historyList) return; historyList.innerHTML = '<div class="spinner"></div>'; const user = auth.currentUser; if (!user) return; const snapshot = await db.collection('reports').where('userId', '==', user.uid).orderBy('createdAt', 'desc').get(); if (snapshot.empty) { historyList.innerHTML = '<p>Вы еще не отправляли ни одного отчета.</p>'; return; } let historyHTML = ''; snapshot.forEach(doc => { const report = doc.data(); const date = report.checkDate.toDate().toLocaleDateString('ru-RU'); const statusText = { booked: 'забронирован', pending: 'в ожидании', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[report.status] || report.status; let commentHTML = ''; if (report.status === 'rejected' && report.rejectionComment) { commentHTML = `<small style="color:var(--status-rejected);"><b>Причина отклонения:</b> ${report.rejectionComment}</small>`; } historyHTML += `<li class="menu-list-item history-item"><div class="status-indicator ${report.status}"></div><div><strong>${report.locationName.replace(/^Б\d+\s*/, '')}</strong><small>Дата: ${date} - Статус: ${statusText}</small>${commentHTML}</div></li>`; }); historyList.innerHTML = historyHTML; }
    
    // --- НАВИГАЦИЯ ---
    document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); const target = b.dataset.target; if (target === 'cooperation-screen') renderAvailableSchedules(); else if (target === 'history-screen') { renderHistory(); showScreen(target); } else showScreen(target); }));
    document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', (e) => { const target = e.currentTarget.dataset.target; showScreen(target); }));
    document.querySelectorAll('.admin-hub-btn').forEach(b => b.addEventListener('click', () => { const target = b.dataset.target; if(target === 'admin-schedule-screen') { loadCitiesForAdmin(); } if(target === 'admin-reports-screen') { renderAllReports(); } if(target === 'admin-users-screen') { renderAllUsers(); } showScreen(target); }));
    if(viewScheduleBtn) viewScheduleBtn.addEventListener('click', () => { renderSchedules(); showScreen('admin-view-schedule-screen'); });
});
