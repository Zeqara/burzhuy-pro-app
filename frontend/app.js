// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let confirmationResult = null;
let currentCheckData = null;
let currentReportId = null;

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
    const phoneForm = document.getElementById('phone-form'), codeForm = document.getElementById('code-form'), profileSetupForm = document.getElementById('profile-setup-form');
    const phoneInput = document.getElementById('phone-input'), codeInput = document.getElementById('code-input'), profileNameInput = document.getElementById('profile-name-input');
    const sendCodeBtn = document.getElementById('send-code-btn');
    const phoneView = document.getElementById('phone-view'), codeView = document.getElementById('code-view');
    const userNameDisplay = document.getElementById('user-name-display'), logoutBtn = document.getElementById('logout-btn');
    const adminMenuBtn = document.getElementById('admin-menu-btn');
    const scheduleForm = document.getElementById('schedule-form'), scheduleLocationSelect = document.getElementById('schedule-location-select'), scheduleDateInput = document.getElementById('schedule-date-input'), timeSlotsContainer = document.getElementById('time-slots-container'), addSlotBtn = document.getElementById('add-slot-btn'), scheduleUrgentCheckbox = document.getElementById('schedule-urgent-checkbox'), scheduleList = document.getElementById('schedule-list');
    const scheduleCardsList = document.getElementById('schedule-cards-list'), noSchedulesView = document.getElementById('no-schedules-view'), lottieAnimationContainer = document.getElementById('lottie-animation'), slotsList = document.getElementById('slots-list'), slotLocationTitle = document.getElementById('slot-location-title');
    const dashboardInfoContainer = document.getElementById('dashboard-info-container');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');
    const historyList = document.getElementById('history-list');
    const adminReportsList = document.getElementById('admin-reports-list'), adminUsersList = document.getElementById('admin-users-list');
    const adminDetailAddress = document.getElementById('admin-detail-address'), adminDetailUser = document.getElementById('admin-detail-user'), adminDetailDate = document.getElementById('admin-detail-date'), adminDetailStatus = document.getElementById('admin-detail-status'), adminDetailPhotos = document.getElementById('admin-detail-photos');
    const adminDetailAnswers = { q1: document.getElementById('admin-detail-q1'), q2: document.getElementById('admin-detail-q2'), q3: document.getElementById('admin-detail-q3'), q4: document.getElementById('admin-detail-q4'), q5: document.getElementById('admin-detail-q5'), q6: document.getElementById('admin-detail-q6'), q7: document.getElementById('admin-detail-q7'), q8: document.getElementById('admin-detail-q8'), q9: document.getElementById('admin-detail-q9'), };

    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });
    if(lottieAnimationContainer) lottie.loadAnimation({ container: lottieAnimationContainer, renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' });

    // --- АУТЕНТИФИКАЦИЯ ---
    if(phoneForm) phoneForm.addEventListener('submit', (e) => { e.preventDefault(); let rawPhoneNumber = phoneInput.value, digitsOnly = rawPhoneNumber.replace(/\D/g, ''); if (digitsOnly.startsWith('8')) digitsOnly = '7' + digitsOnly.substring(1); const formattedPhoneNumber = `+${digitsOnly}`; if (digitsOnly.length < 11) return alert('Пожалуйста, введите полный номер телефона.'); sendCodeBtn.disabled = true; sendCodeBtn.textContent = 'Отправка...'; auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier).then(result => { confirmationResult = result; phoneView.style.display = 'none'; codeView.style.display = 'block'; alert('СМС-код отправлен на ваш номер.'); }).catch(err => { console.error("Firebase Error:", err); alert(`Произошла ошибка: \nКод: ${err.code}\nСообщение: ${err.message}`); }).finally(() => { sendCodeBtn.disabled = false; sendCodeBtn.textContent = 'Получить код'; }); });
    if(codeForm) codeForm.addEventListener('submit', (e) => { e.preventDefault(); const code = codeInput.value; if (!code || !confirmationResult) return; confirmationResult.confirm(code).catch(err => alert(`Неверный код.`)); });
    if(profileSetupForm) profileSetupForm.addEventListener('submit', (e) => { e.preventDefault(); const user = auth.currentUser, fullName = profileNameInput.value.trim(); if (!user || !fullName) return; db.collection('users').doc(user.uid).set({ fullName, phone: user.phoneNumber, role: 'guest' }).then(() => { userNameDisplay.textContent = fullName; showScreen('main-menu-screen'); }).catch(err => alert(`Не удалось сохранить профиль.`)); });

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
            });
        } else {
            if(adminMenuBtn) adminMenuBtn.style.display = 'none';
            if(phoneView && codeView) { phoneView.style.display = 'block'; codeView.style.display = 'none'; }
            showScreen('auth-screen');
        }
    });
    
    if(logoutBtn) logoutBtn.addEventListener('click', () => { if(dashboardUpdateInterval) clearInterval(dashboardUpdateInterval); auth.signOut(); });

    // --- ЛОГИКА АДМИН-ПАНЕЛИ ---
    if (adminMenuBtn) adminMenuBtn.addEventListener('click', () => showScreen('admin-hub-screen'));
    async function loadLocationsForAdmin() { if (!scheduleLocationSelect) return; const snapshot = await db.collection('locations').get(); let optionsHTML = '<option value="" disabled selected>-- Выберите точку --</option>'; snapshot.forEach(doc => { const loc = doc.data(); optionsHTML += `<option value="${doc.id}" data-name="${loc.name}" data-address="${loc.address}">${loc.name} (${loc.address})</option>`; }); scheduleLocationSelect.innerHTML = optionsHTML; }
    function addSlotInput() { const slotDiv = document.createElement('div'); slotDiv.className = 'time-slot-input'; slotDiv.innerHTML = `<input type="time" class="slot-start" required> - <input type="time" class="slot-end" required><button type="button" class="remove-slot-btn">×</button>`; if(timeSlotsContainer) timeSlotsContainer.appendChild(slotDiv); slotDiv.querySelector('.remove-slot-btn').addEventListener('click', () => slotDiv.remove()); }
    if(addSlotBtn) { addSlotBtn.addEventListener('click', addSlotInput); addSlotInput(); }
    if(scheduleForm) scheduleForm.addEventListener('submit', async (e) => { e.preventDefault(); const selOpt = scheduleLocationSelect.options[scheduleLocationSelect.selectedIndex]; const locationId = selOpt.value, locationName = selOpt.dataset.name, locationAddress = selOpt.dataset.address, date = scheduleDateInput.value, isUrgent = scheduleUrgentCheckbox.checked; const timeSlots = Array.from(document.querySelectorAll('.time-slot-input')).map(s => ({ start: s.querySelector('.slot-start').value, end: s.querySelector('.slot-end').value })).filter(ts => ts.start && ts.end); if (!locationId || !date || timeSlots.length === 0) return alert('Заполните все поля.'); const scheduleDocRef = await db.collection('schedule').add({ locationId, locationName, locationAddress, date: new Date(date), isUrgent }); const batch = db.batch(); timeSlots.forEach(slot => { const slotDocRef = db.collection('timeSlots').doc(); batch.set(slotDocRef, { scheduleId: scheduleDocRef.id, startTime: slot.start, endTime: slot.end, status: 'свободен', bookedBy: null, agentName: null }); }); await batch.commit(); alert('Проверка добавлена!'); scheduleForm.reset(); timeSlotsContainer.innerHTML = ''; addSlotInput(); renderSchedules(); });
    async function renderSchedules() { if (!scheduleList) return; scheduleList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('schedule').orderBy('date', 'desc').get(); if(snapshot.empty) { scheduleList.innerHTML = '<p>Запланированных проверок нет.</p>'; return; } let listHTML = ''; snapshot.forEach(doc => { const s = doc.data(); const date = s.date.toDate().toLocaleDateString('ru-RU'); listHTML += `<div class="schedule-item ${s.isUrgent ? 'urgent' : ''}"><div><strong>${s.locationName}</strong><small>${date} ${s.isUrgent ? '🔥' : ''}</small></div><button class="delete-schedule-btn" data-id="${doc.id}">Удалить</button></div>`; }); scheduleList.innerHTML = listHTML; document.querySelectorAll('.delete-schedule-btn').forEach(button => button.addEventListener('click', async (e) => { if (confirm('Удалить эту проверку?')) await deleteSchedule(e.target.dataset.id); })); }
    async function deleteSchedule(scheduleId) { try { await db.collection('schedule').doc(scheduleId).delete(); const slotsSnapshot = await db.collection('timeSlots').where('scheduleId', '==', scheduleId).get(); const batch = db.batch(); slotsSnapshot.forEach(doc => { batch.delete(doc.ref); }); await batch.commit(); alert('Проверка удалена.'); renderSchedules(); } catch (error) { console.error('Ошибка:', error); alert('Не удалось удалить.'); } }
    async function loadAdminStats() { const statsContainer = document.getElementById('admin-stats-container'); if (!statsContainer) return; const pendingReports = await db.collection('reports').where('status', '==', 'pending').get(); const totalUsers = await db.collection('users').get(); statsContainer.innerHTML = `<div class="stat-card"><strong>${pendingReports.size}</strong><small>Отчетов на проверке</small></div><div class="stat-card"><strong>${totalUsers.size}</strong><small>Всего пользователей</small></div>`; }
    async function renderAllReports() { if (!adminReportsList) return; adminReportsList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('reports').orderBy('checkDate', 'desc').get(); if (snapshot.empty) { adminReportsList.innerHTML = '<p>Отчетов пока нет.</p>'; return; } let html = ''; const userPromises = []; snapshot.forEach(doc => userPromises.push(db.collection('users').doc(doc.data().userId).get())); const userDocs = await Promise.all(userPromises); const usersMap = new Map(userDocs.map(d => [d.id, d.data()])); snapshot.forEach(doc => { const r = doc.data(); const user = usersMap.get(r.userId); const date = r.checkDate.toDate().toLocaleDateString('ru-RU'); const statusText = { pending: 'в ожидании', approved: 'принят', rejected: 'отклонен' }[r.status] || r.status; html += `<li class="menu-list-item report-item" data-id="${doc.id}"><div class="status-indicator ${r.status}"></div><div><strong>${r.locationName}</strong><small>${user?.fullName || 'Неизвестно'} - ${date} - ${statusText}</small></div></li>`; }); adminReportsList.innerHTML = html; adminReportsList.querySelectorAll('.report-item').forEach(item => item.addEventListener('click', () => openAdminReportDetail(item.dataset.id))); }
    async function openAdminReportDetail(reportId) { currentReportId = reportId; showScreen('admin-report-detail-screen'); const doc = await db.collection('reports').doc(reportId).get(); if (!doc.exists) return; const report = doc.data(); const userDoc = await db.collection('users').doc(report.userId).get(); const statusText = { pending: 'в ожидании', approved: 'принят', rejected: 'отклонен' }[report.status] || report.status; adminDetailAddress.textContent = report.locationAddress; adminDetailUser.textContent = userDoc.data()?.fullName || 'Неизвестно'; adminDetailDate.textContent = report.checkDate.toDate().toLocaleString('ru-RU'); adminDetailStatus.textContent = statusText; Object.keys(adminDetailAnswers).forEach((key, i) => adminDetailAnswers[key].textContent = report.answers[`q${i+1}_` + Object.keys(report.answers)[i].split('_')[1]] || '—'); adminDetailPhotos.innerHTML = report.imageUrls && report.imageUrls.length > 0 ? report.imageUrls.map(url => `<a href="${url}" target="_blank"><img src="${url}" style="max-width: 100%; border-radius: 8px; margin-top: 10px;"></a>`).join('') : '<p>Фото не прикреплены.</p>'; }
    async function updateReportStatus(newStatus) { if (!currentReportId) return; await db.collection('reports').doc(currentReportId).update({ status: newStatus }); alert(`Статус изменен.`); renderAllReports(); loadAdminStats(); showScreen('admin-reports-screen'); }
    document.getElementById('admin-action-approve')?.addEventListener('click', () => updateReportStatus('approved')); document.getElementById('admin-action-reject')?.addEventListener('click', () => updateReportStatus('rejected'));
    async function renderAllUsers() { if (!adminUsersList) return; adminUsersList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('users').get(); let html = ''; snapshot.forEach(doc => { const u = doc.data(); html += `<li class="menu-list-item user-item"><div><strong>${u.fullName}</strong><small>${u.phone}</small></div><div class="role-tag ${u.role}">${u.role}</div></li>`; }); adminUsersList.innerHTML = html; }
    
    // --- ЛОГИКА АГЕНТА ---
    async function renderAvailableSchedules() { /* ... без изменений ... */ }
    async function renderTimeSlots(scheduleId, locationTitle) { /* ... без изменений ... */ }
    let dashboardUpdateInterval = null;
    async function loadUserDashboard(userId) { /* ... без изменений ... */ }
    function openChecklist() { /* ... без изменений ... */ }
    if(checklistForm) checklistForm.addEventListener('submit', async (e) => { e.preventDefault(); const user = auth.currentUser; if (!user || !currentCheckData) return; const photoFiles = document.getElementById('checklist-photos').files; const uploadPromises = Array.from(photoFiles).map(file => { const filePath = `reports/${user.uid}/${Date.now()}_${file.name}`; const fileRef = storage.ref(filePath); return fileRef.put(file).then(() => fileRef.getDownloadURL()); }); const imageUrls = await Promise.all(uploadPromises); const reportData = { userId: user.uid, slotId: currentCheckData.id, checkDate: new Date(), status: 'pending', imageUrls, locationName: currentCheckData.locationName, locationAddress: currentCheckData.locationAddress, answers: { q1_appearance: document.getElementById('checklist-q1-appearance').value, q2_cleanliness: document.getElementById('checklist-q2-cleanliness').value, q3_greeting: document.getElementById('checklist-q3-greeting').value, q4_upsell: document.getElementById('checklist-q4-upsell').value, q5_actions: document.getElementById('checklist-q5-actions').value, q6_handout: document.getElementById('checklist-q6-handout').value, q7_order_eval: document.getElementById('checklist-q7-order-eval').value, q8_food_rating: document.getElementById('checklist-q8-food-rating').value, q9_comments: document.getElementById('checklist-q9-comments').value, } }; await db.collection('reports').add(reportData); await db.collection('timeSlots').doc(currentCheckData.id).update({ status: 'завершен' }); alert('Спасибо за ваш отчёт ✅'); currentCheckData = null; loadUserDashboard(user.uid); showScreen('main-menu-screen'); });
    async function renderHistory() { if (!historyList) return; historyList.innerHTML = '<div class="spinner"></div>'; const user = auth.currentUser; if (!user) return; const snapshot = await db.collection('reports').where('userId', '==', user.uid).orderBy('checkDate', 'desc').get(); if (snapshot.empty) { historyList.innerHTML = '<p>Вы еще не отправляли ни одного отчета.</p>'; return; } let historyHTML = ''; snapshot.forEach(doc => { const report = doc.data(); const date = report.checkDate.toDate().toLocaleDateString('ru-RU'); const statusText = { pending: 'в ожидании', approved: 'принят', rejected: 'отклонен' }[report.status] || report.status; historyHTML += `<li class="menu-list-item history-item"><div class="status-indicator ${report.status}"></div><div><strong>${report.locationName}</strong><small>Дата: ${date} - Статус: ${statusText}</small></div></li>`; }); historyList.innerHTML = historyHTML; }

    // --- НАВИГАЦИЯ ---
    document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); const target = b.dataset.target; if (target === 'cooperation-screen') renderAvailableSchedules(); else if (target === 'history-screen') { renderHistory(); showScreen(target); } else showScreen(target); }));
    document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    document.querySelectorAll('.admin-hub-btn').forEach(b => b.addEventListener('click', () => { const target = b.dataset.target; if(target === 'admin-schedule-screen') { loadLocationsForAdmin(); renderSchedules(); } if(target === 'admin-reports-screen') renderAllReports(); if(target === 'admin-users-screen') renderAllUsers(); showScreen(target); }));
});
