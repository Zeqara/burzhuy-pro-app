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
    if(type === 'confirm') modalConfirmBtn.textContent = 'Подтвердить';
    
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
    const scheduleForm = document.getElementById('schedule-form'), scheduleCitySelect = document.getElementById('schedule-city-select'), scheduleLocationSelect = document.getElementById('schedule-location-select'), scheduleDateInput = document.getElementById('schedule-date-input'), timeSlotsContainer = document.getElementById('time-slots-container'), addSlotBtn = document.getElementById('add-slot-btn'), scheduleUrgentCheckbox = document.getElementById('schedule-urgent-checkbox'), scheduleList = document.getElementById('schedule-list'), viewScheduleBtn = document.getElementById('view-schedule-btn');
    const scheduleCardsList = document.getElementById('schedule-cards-list'), noSchedulesView = document.getElementById('no-schedules-view'), lottieAnimationContainer = document.getElementById('lottie-animation'), slotsList = document.getElementById('slots-list'), slotLocationTitle = document.getElementById('slot-location-title');
    const dashboardInfoContainer = document.getElementById('dashboard-info-container');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');
    const historyList = document.getElementById('history-list');
    const adminReportsList = document.getElementById('admin-reports-list'), adminUsersList = document.getElementById('admin-users-list');
    const adminDetailAddress = document.getElementById('admin-detail-address'), adminDetailUser = document.getElementById('admin-detail-user'), adminDetailPhone = document.getElementById('admin-detail-phone'), adminDetailDate = document.getElementById('admin-detail-date'), adminDetailStatus = document.getElementById('admin-detail-status'), adminDetailPhotos = document.getElementById('admin-detail-photos'), adminDetailRejectionComment = document.getElementById('admin-detail-rejection-comment-container');
    const adminDetailAnswers = { q1: document.getElementById('admin-detail-q1'), q2: document.getElementById('admin-detail-q2'), q3: document.getElementById('admin-detail-q3'), q4: document.getElementById('admin-detail-q4'), q5: document.getElementById('admin-detail-q5'), q6: document.getElementById('admin-detail-q6'), q7: document.getElementById('admin-detail-q7'), q8: document.getElementById('admin-detail-q8'), q9: document.getElementById('admin-detail-q9'), };
    
    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });
    if(lottieAnimationContainer) lottie.loadAnimation({ container: lottieAnimationContainer, renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' });

    // --- АУТЕНТИФИКАЦИЯ ---
    if(phoneForm) phoneForm.addEventListener('submit', (e) => { e.preventDefault(); let rawPhoneNumber = phoneInput.value, digitsOnly = rawPhoneNumber.replace(/\D/g, ''); if (digitsOnly.startsWith('8')) digitsOnly = '7' + digitsOnly.substring(1); const formattedPhoneNumber = `+${digitsOnly}`; if (digitsOnly.length < 11) return showModal('Ошибка', 'Пожалуйста, введите полный номер телефона.'); sendCodeBtn.disabled = true; sendCodeBtn.textContent = 'Отправка...'; auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier).then(result => { confirmationResult = result; phoneView.style.display = 'none'; codeView.style.display = 'block'; showModal('Успешно', 'СМС-код отправлен на ваш номер.'); }).catch(err => showModal('Ошибка', `Произошла ошибка: ${err.code}`)).finally(() => { sendCodeBtn.disabled = false; sendCodeBtn.textContent = 'Получить код'; }); });
    if(codeForm) codeForm.addEventListener('submit', (e) => { e.preventDefault(); const code = codeInput.value; if (!code || !confirmationResult) return; confirmationResult.confirm(code).catch(err => showModal('Ошибка', 'Неверный код. Попробуйте еще раз.')); });
    if(profileSetupForm) profileSetupForm.addEventListener('submit', (e) => { e.preventDefault(); const user = auth.currentUser, fullName = profileNameInput.value.trim(); if (!user || !fullName) return; db.collection('users').doc(user.uid).set({ fullName, phone: user.phoneNumber, role: 'guest' }).then(() => { userNameDisplay.textContent = fullName; showScreen('main-menu-screen'); }).catch(err => showModal('Ошибка', 'Не удалось сохранить профиль.')); });

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР ---
    auth.onAuthStateChanged(user => {
        if (user) { db.collection('users').doc(user.uid).get().then(doc => { if (doc.exists) { const userData = doc.data(); userNameDisplay.textContent = userData.fullName; if (adminMenuBtn) adminMenuBtn.style.display = (userData.role === 'admin') ? 'flex' : 'none'; if (userData.role === 'admin') loadAdminStats(); loadUserDashboard(user.uid); showScreen('main-menu-screen'); } else { showScreen('profile-setup-screen'); } }); }
        else { if(adminMenuBtn) adminMenuBtn.style.display = 'none'; if(phoneView && codeView) { phoneView.style.display = 'block'; codeView.style.display = 'none'; } showScreen('auth-screen'); }
    });
    
    if(logoutBtn) logoutBtn.addEventListener('click', () => { if(dashboardUpdateInterval) clearInterval(dashboardUpdateInterval); auth.signOut(); });

    // --- ЛОГИКА АДМИН-ПАНЕЛИ ---
    if (adminMenuBtn) adminMenuBtn.addEventListener('click', () => showScreen('admin-hub-screen'));
    
    async function loadCitiesForAdmin() { if (!scheduleCitySelect) return; const snapshot = await db.collection('cities').orderBy('name').get(); let optionsHTML = '<option value="" disabled selected>-- Выберите город --</option>'; snapshot.forEach(doc => { optionsHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; }); scheduleCitySelect.innerHTML = optionsHTML; }
    if (scheduleCitySelect) { scheduleCitySelect.addEventListener('change', async (e) => { const selectedCity = e.target.value; scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- Загрузка... --</option>'; if (!selectedCity) { scheduleLocationSelect.disabled = true; return; } const snapshot = await db.collection('locations').where('city', '==', selectedCity).get(); let optionsHTML = '<option value="" disabled selected>-- Выберите точку --</option>'; snapshot.forEach(doc => { const loc = doc.data(); const cleanName = loc.name.replace(/^Б\d+\s*/, ''); optionsHTML += `<option value="${doc.id}" data-name="${loc.name}" data-address="${loc.address}">${cleanName}</option>`; }); scheduleLocationSelect.innerHTML = optionsHTML; scheduleLocationSelect.disabled = false; }); }
    
    function addSlotInput() { const slotDiv = document.createElement('div'); slotDiv.className = 'time-slot-input'; slotDiv.innerHTML = `<input type="time" class="slot-start" required> - <input type="time" class="slot-end" required><button type="button" class="remove-slot-btn">×</button>`; if(timeSlotsContainer) timeSlotsContainer.appendChild(slotDiv); slotDiv.querySelector('.remove-slot-btn').addEventListener('click', () => slotDiv.remove()); }
    if(addSlotBtn) { addSlotBtn.addEventListener('click', addSlotInput); addSlotInput(); }
    if(scheduleForm) scheduleForm.addEventListener('submit', async (e) => { e.preventDefault(); const city = scheduleCitySelect.value; const selOpt = scheduleLocationSelect.options[scheduleLocationSelect.selectedIndex]; const locationId = selOpt.value, locationName = selOpt.dataset.name, locationAddress = selOpt.dataset.address, date = scheduleDateInput.value, isUrgent = scheduleUrgentCheckbox.checked; const timeSlots = Array.from(document.querySelectorAll('.time-slot-input')).map(s => ({ start: s.querySelector('.slot-start').value, end: s.querySelector('.slot-end').value })).filter(ts => ts.start && ts.end); if (!city || !locationId || !date || timeSlots.length === 0) return showModal('Ошибка', 'Заполните все поля.'); const scheduleDocRef = await db.collection('schedule').add({ city, locationId, locationName, locationAddress, date: new Date(date), isUrgent }); const batch = db.batch(); timeSlots.forEach(slot => { const slotDocRef = db.collection('timeSlots').doc(); batch.set(slotDocRef, { scheduleId: scheduleDocRef.id, startTime: slot.start, endTime: slot.end, status: 'свободен', bookedBy: null, agentName: null }); }); await batch.commit(); showModal('Успешно', 'Проверка добавлена в график!'); scheduleForm.reset(); timeSlotsContainer.innerHTML = ''; addSlotInput(); scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- ... --</option>'; scheduleLocationSelect.disabled = true; });
    
    async function renderSchedules() { if (!scheduleList) return; scheduleList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('schedule').orderBy('date', 'desc').get(); if(snapshot.empty) { scheduleList.innerHTML = '<p>Запланированных проверок нет.</p>'; return; } let listHTML = ''; snapshot.forEach(doc => { const s = doc.data(); const date = s.date.toDate().toLocaleDateString('ru-RU'); const cleanName = s.locationName.replace(/^Б\d+\s*/, ''); listHTML += `<div class="schedule-item ${s.isUrgent ? 'urgent' : ''}"><div><strong>${s.city ? s.city + ': ' : ''}${cleanName}</strong><small>${date} ${s.isUrgent ? '🔥' : ''}</small></div><button class="delete-schedule-btn" data-id="${doc.id}">Удалить</button></div>`; }); scheduleList.innerHTML = listHTML; document.querySelectorAll('.delete-schedule-btn').forEach(button => button.addEventListener('click', (e) => deleteSchedule(e.target.dataset.id))); }
    function deleteSchedule(scheduleId) { showModal('Удаление', 'Удалить эту проверку и все связанные с ней слоты?', 'confirm', async (confirmed) => { if(confirmed) { try { await db.collection('schedule').doc(scheduleId).delete(); const slotsSnapshot = await db.collection('timeSlots').where('scheduleId', '==', scheduleId).get(); const batch = db.batch(); slotsSnapshot.forEach(doc => batch.delete(doc.ref)); await batch.commit(); showModal('Успешно', 'Проверка удалена.'); renderSchedules(); } catch (error) { showModal('Ошибка', 'Не удалось удалить проверку.'); } } }); }
    async function loadAdminStats() { const statsContainer = document.getElementById('admin-stats-container'); if (!statsContainer) return; const pendingReports = await db.collection('reports').where('status', '==', 'pending').get(); const totalUsers = await db.collection('users').get(); statsContainer.innerHTML = `<div class="stat-card"><strong>${pendingReports.size}</strong><small>Отчетов на проверке</small></div><div class="stat-card"><strong>${totalUsers.size}</strong><small>Всего пользователей</small></div>`; }
    async function renderAllReports() { if (!adminReportsList) return; adminReportsList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('reports').orderBy('checkDate', 'desc').get(); if (snapshot.empty) { adminReportsList.innerHTML = '<p>Отчетов пока нет.</p>'; return; } let html = ''; const userIds = [...new Set(snapshot.docs.map(doc => doc.data().userId))]; if (userIds.length > 0) { const userPromises = userIds.map(id => db.collection('users').doc(id).get()); const userDocs = await Promise.all(userPromises); const usersMap = new Map(userDocs.map(d => [d.id, d.data()])); snapshot.forEach(doc => { const r = doc.data(); const user = usersMap.get(r.userId); const date = r.checkDate.toDate().toLocaleDateString('ru-RU'); const statusText = { pending: 'в ожидании', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[r.status] || r.status; html += `<li class="menu-list-item report-item" data-id="${doc.id}"><div class="status-indicator ${r.status}"></div><div><strong>${r.locationName.replace(/^Б\d+\s*/, '')}</strong><small>${user?.fullName || 'Агент'} - ${date} - ${statusText}</small></div><button class="delete-report-btn" data-id="${doc.id}">Удалить</button></li>`; }); } adminReportsList.innerHTML = html; adminReportsList.querySelectorAll('.report-item').forEach(item => item.addEventListener('click', (e) => { if (e.target.classList.contains('delete-report-btn')) return; openAdminReportDetail(item.dataset.id); })); adminReportsList.querySelectorAll('.delete-report-btn').forEach(button => button.addEventListener('click', (e) => deleteReport(e.target.dataset.id))); }
    
    async function openAdminReportDetail(reportId) {
        currentReportId = reportId;
        showScreen('admin-report-detail-screen');
        const doc = await db.collection('reports').doc(reportId).get();
        if (!doc.exists) return;
        const report = doc.data();
        const userDoc = await db.collection('users').doc(report.userId).get();
        const userData = userDoc.exists() ? userDoc.data() : {};
        const statusText = { pending: 'в ожидании', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[report.status] || report.status;
        
        adminDetailAddress.textContent = report.locationAddress;
        adminDetailUser.textContent = userData.fullName || 'Агент не найден';
        adminDetailPhone.textContent = userData.phone || 'Не указан';
        adminDetailDate.textContent = report.checkDate.toDate().toLocaleString('ru-RU');
        adminDetailStatus.textContent = statusText;

        document.getElementById('admin-action-paid').style.display = (report.status === 'approved') ? 'block' : 'none';

        if (report.status === 'rejected' && report.rejectionComment) {
            adminDetailRejectionComment.style.display = 'block';
            adminDetailRejectionComment.innerHTML = `<h4>Причина отклонения:</h4><p>${report.rejectionComment}</p>`;
        } else {
            adminDetailRejectionComment.style.display = 'none';
        }

        const answers = report.answers || {};
        adminDetailAnswers.q1.textContent = answers.q1_appearance || '—';
        adminDetailAnswers.q2.textContent = answers.q2_cleanliness || '—';
        adminDetailAnswers.q3.textContent = answers.q3_greeting || '—';
        adminDetailAnswers.q4.textContent = answers.q4_upsell || '—';
        adminDetailAnswers.q5.textContent = answers.q5_actions || '—';
        adminDetailAnswers.q6.textContent = answers.q6_handout || '—';
        adminDetailAnswers.q7.textContent = answers.q7_order_eval || '—';
        adminDetailAnswers.q8.textContent = answers.q8_food_rating || '—';
        adminDetailAnswers.q9.textContent = answers.q9_comments || '—';
        adminDetailPhotos.innerHTML = report.imageUrls && report.imageUrls.length > 0 ? report.imageUrls.map(url => `<a href="${url}" target="_blank"><img src="${url}"></a>`).join('') : '<p>Фото не прикреплены.</p>';
    }

    function updateReportStatus(newStatus) {
        if (newStatus === 'rejected') {
            const modal = document.getElementById('rejection-modal-container');
            const confirmBtn = document.getElementById('rejection-modal-confirm-btn');
            const cancelBtn = document.getElementById('rejection-modal-cancel-btn');
            const commentInput = document.getElementById('rejection-comment-input');
            commentInput.value = '';
            modal.classList.remove('modal-hidden');
            const confirmHandler = async () => {
                const comment = commentInput.value.trim();
                cleanup();
                if (!comment) {
                    showModal('Ошибка', 'Пожалуйста, укажите причину отклонения.');
                    return;
                }
                await db.collection('reports').doc(currentReportId).update({ status: 'rejected', rejectionComment: comment });
                showModal('Успешно', `Статус отчета изменен.`);
                renderAllReports();
                loadAdminStats();
                showScreen('admin-reports-screen');
            };
            const cancelHandler = () => cleanup();
            const cleanup = () => {
                modal.classList.add('modal-hidden');
                confirmBtn.removeEventListener('click', confirmHandler);
                cancelBtn.removeEventListener('click', cancelHandler);
            };
            confirmBtn.addEventListener('click', confirmHandler);
            cancelBtn.addEventListener('click', cancelHandler);
        } else {
            showModal('Подтверждение', `Вы уверены, что хотите изменить статус на "${{approved: 'принят', paid: 'оплачен'}[newStatus]}"?`, 'confirm', async (confirmed) => {
                if(confirmed) {
                    if (!currentReportId) return;
                    await db.collection('reports').doc(currentReportId).update({ 
                        status: newStatus, 
                        rejectionComment: firebase.firestore.FieldValue.delete() 
                    });
                    showModal('Успешно', `Статус отчета изменен.`);
                    renderAllReports();
                    loadAdminStats();
                    showScreen('admin-reports-screen');
                }
            });
        }
    }
    
    document.getElementById('admin-action-approve')?.addEventListener('click', () => updateReportStatus('approved'));
    document.getElementById('admin-action-reject')?.addEventListener('click', () => updateReportStatus('rejected'));
    document.getElementById('admin-action-paid')?.addEventListener('click', () => updateReportStatus('paid'));

    async function deleteReport(reportId) { showModal('Удаление', 'Вы уверены, что хотите безвозвратно удалить этот отчет и все прикрепленные к нему фотографии?', 'confirm', async (confirmed) => { if (confirmed) { try { const reportRef = db.collection('reports').doc(reportId); const reportDoc = await reportRef.get(); if (reportDoc.exists) { const reportData = reportDoc.data(); const imageUrls = reportData.imageUrls; if (imageUrls && imageUrls.length > 0) { const deletePromises = imageUrls.map(url => storage.refFromURL(url).delete()); await Promise.all(deletePromises); } } await reportRef.delete(); showModal('Успешно', 'Отчет и все фотографии были удалены.'); renderAllReports(); } catch (e) { console.error("Ошибка при удалении отчета: ", e); showModal('Ошибка', 'Не удалось удалить отчет или его файлы.'); } } }); }
    async function renderAllUsers() { if (!adminUsersList) return; adminUsersList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('users').get(); let html = ''; snapshot.forEach(doc => { const u = doc.data(); html += `<li class="menu-list-item user-item"><div><strong>${u.fullName}</strong><small>${u.phone}</small></div><button class="role-tag-btn" data-id="${doc.id}" data-role="${u.role}" data-name="${u.fullName}"><div class="role-tag ${u.role}">${u.role}</div></button></li>`; }); adminUsersList.innerHTML = html; adminUsersList.querySelectorAll('.role-tag-btn').forEach(button => button.addEventListener('click', (e) => { const currentTarget = e.currentTarget; toggleUserRole(currentTarget.dataset.id, currentTarget.dataset.role, currentTarget.dataset.name); })); }
    function toggleUserRole(userId, currentRole, name) { const newRole = currentRole === 'admin' ? 'guest' : 'admin'; showModal('Смена роли', `Сменить роль для "${name}" на "${newRole}"?`, 'confirm', async (confirmed) => { if(confirmed) { try { await db.collection('users').doc(userId).update({ role: newRole }); showModal('Успешно', 'Роль пользователя изменена.'); renderAllUsers(); } catch (e) { showModal('Ошибка', 'Не удалось изменить роль.'); } } }); }
    
    // --- ЛОГИКА АГЕНТА ---
    async function renderAvailableSchedules() {
        showScreen('cooperation-screen');
        if (!scheduleCardsList || !noSchedulesView) return;
        scheduleCardsList.innerHTML = '<div class="spinner"></div>'; noSchedulesView.style.display = 'none'; const user = auth.currentUser; if (!user) return;
        const existingBookingSnapshot = await db.collection('timeSlots').where('bookedBy', '==', user.uid).where('status', '==', 'забронирован').get();
        if (!existingBookingSnapshot.empty) {
            scheduleCardsList.innerHTML = ''; noSchedulesView.innerHTML = `<div id="lottie-animation-booked"></div><h3>У вас уже есть активная проверка</h3><p>Завершите ее, прежде чем записываться на новую. Информация о ней находится на главном экране.</p>`; noSchedulesView.style.display = 'block'; if (document.getElementById('lottie-animation-booked')) lottie.loadAnimation({ container: document.getElementById('lottie-animation-booked'), renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' }); return;
        }
        const now = new Date(); now.setHours(0, 0, 0, 0); const snapshot = await db.collection('schedule').where('date', '>=', now).get(); let schedules = []; snapshot.forEach(doc => schedules.push({ id: doc.id, ...doc.data() })); schedules.sort((a, b) => (a.isUrgent && !b.isUrgent) ? -1 : (!a.isUrgent && b.isUrgent) ? 1 : a.date.toMillis() - b.date.toMillis());
        if (schedules.length === 0) {
            scheduleCardsList.innerHTML = ''; noSchedulesView.innerHTML = `<div id="lottie-animation"></div><h3>Пока нет доступных проверок</h3><p>Отличная работа! Все задания выполнены.</p>`; noSchedulesView.style.display = 'block'; if (document.getElementById('lottie-animation')) lottie.loadAnimation({ container: document.getElementById('lottie-animation'), renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' }); return;
        }
        const schedulesByCity = schedules.reduce((acc, schedule) => { const city = schedule.city || 'Другое'; if (!acc[city]) acc[city] = []; acc[city].push(schedule); return acc; }, {});
        let cardsHTML = '';
        for (const city in schedulesByCity) {
            cardsHTML += `<h3 class="city-header">${city}</h3>`;
            schedulesByCity[city].forEach(s => { const date = s.date.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); cardsHTML += `<li class="menu-list-item schedule-card ${s.isUrgent ? 'urgent' : ''}" data-schedule-id="${s.id}" data-location-title="${s.locationName.replace(/^Б\d+\s*/, '')} (${date})"><i class="icon fa-solid ${s.isUrgent ? 'fa-fire' : 'fa-calendar-day'}"></i><div><strong>${s.locationName.replace(/^Б\d+\s*/, '')}</strong><small>${s.locationAddress} - <b>${date}</b></small></div></li>`; });
        }
        scheduleCardsList.innerHTML = cardsHTML;
        document.querySelectorAll('.schedule-card').forEach(c => c.addEventListener('click', () => renderTimeSlots(c.dataset.scheduleId, c.dataset.locationTitle)));
    }

    async function renderTimeSlots(scheduleId, locationTitle) { showScreen('time-slots-screen'); if (!slotsList || !slotLocationTitle) return; slotLocationTitle.textContent = locationTitle; slotsList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('timeSlots').where('scheduleId', '==', scheduleId).where('status', '==', 'свободен').get(); if (snapshot.empty) { slotsList.innerHTML = '<p>К сожалению, все свободные места уже заняты.</p>'; return; } let slotsHTML = ''; snapshot.forEach(doc => { const s = doc.data(); slotsHTML += `<li class="menu-list-item time-slot" data-slot-id="${doc.id}"><i class="icon fa-solid fa-clock"></i><div><strong>${s.startTime} - ${s.endTime}</strong></div></li>`; }); slotsList.innerHTML = slotsHTML; document.querySelectorAll('.time-slot').forEach(s => s.addEventListener('click', () => { showModal('Подтверждение', 'Вы уверены, что хотите записаться на это время?', 'confirm', async (confirmed) => { if(confirmed) { const user = auth.currentUser; if (!user) return; const userDoc = await db.collection('users').doc(user.uid).get(); await db.collection('timeSlots').doc(s.dataset.slotId).update({ status: 'забронирован', bookedBy: user.uid, agentName: userDoc.data().fullName }); showModal('Успешно', 'Вы записаны! Информация появится на главном экране.'); loadUserDashboard(user.uid); showScreen('main-menu-screen'); } }); })); }
    
    let dashboardUpdateInterval = null;
    async function loadUserDashboard(userId) {
        if (!dashboardInfoContainer) return;
        if (dashboardUpdateInterval) clearInterval(dashboardUpdateInterval);
        const snapshot = await db.collection('timeSlots').where('bookedBy', '==', userId).where('status', '==', 'забронирован').limit(1).get();
        if (snapshot.empty) {
            dashboardInfoContainer.innerHTML = ''; // Убираем старую карточку
            return;
        }
        const doc = snapshot.docs[0];
        const booking = { id: doc.id, ...doc.data() };
        const scheduleDoc = await db.collection('schedule').doc(booking.scheduleId).get();
        if (!scheduleDoc.exists) { // Проверка, что расписание не удалили
            dashboardInfoContainer.innerHTML = '';
            return;
        }
        const schedule = scheduleDoc.data();
        currentCheckData = { ...booking, ...schedule };

        function updateDashboard() {
            const checkDate = schedule.date.toDate();
            const [startHour, startMinute] = booking.startTime.split(':');
            const [endHour, endMinute] = booking.endTime.split(':');
            const startTime = new Date(checkDate.getTime()); startTime.setHours(startHour, startMinute, 0, 0);
            const endTime = new Date(checkDate.getTime()); endTime.setHours(endHour, endMinute, 0, 0);
            const now = new Date();
            let buttonHTML = '';
            if (now >= startTime && now <= endTime) {
                buttonHTML = `<button id="start-check-btn" class="btn-primary">Начать проверку</button>`;
            } else if (now < startTime) {
                const diff = startTime - now;
                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                buttonHTML = `<button class="btn-primary" disabled>Начнется через ${hours} ч ${minutes} мин</button>`;
            } else {
                buttonHTML = `<button class="btn-primary" disabled>Время истекло</button>`;
            }
            dashboardInfoContainer.innerHTML = `<div class="next-check-card">
                <small>Ваша следующая проверка:</small>
                <strong>${schedule.locationName.replace(/^Б\d+\s*/, '')}</strong>
                <p><i class="fa-solid fa-calendar-day"></i> ${checkDate.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})}</p>
                <p><i class="fa-solid fa-clock"></i> ${booking.startTime} - ${booking.endTime}</p>
                ${buttonHTML}
                <button id="cancel-booking-btn" class="btn-secondary">Отменить запись</button>
            </div>`;
            document.getElementById('start-check-btn')?.addEventListener('click', openChecklist);
            document.getElementById('cancel-booking-btn')?.addEventListener('click', () => cancelBooking(booking.id));
        }
        updateDashboard();
        dashboardUpdateInterval = setInterval(updateDashboard, 60000);
    }

    async function cancelBooking(slotId) {
        showModal('Отмена записи', 'Вы уверены, что хотите отменить эту проверку? Слот станет доступен другим агентам.', 'confirm', async (confirmed) => {
            if (confirmed) {
                if (!auth.currentUser) return;
                try {
                    await db.collection('timeSlots').doc(slotId).update({
                        status: 'свободен',
                        bookedBy: null,
                        agentName: null
                    });
                    showModal('Успешно', 'Ваша запись отменена.');
                    loadUserDashboard(auth.currentUser.uid); // Обновляем дашборд
                } catch (error) {
                    showModal('Ошибка', 'Не удалось отменить запись. Попробуйте позже.');
                }
            }
        });
    }

    function openChecklist() { if (!currentCheckData) return; checklistAddress.textContent = currentCheckData.locationAddress; checklistDate.textContent = new Date().toLocaleString('ru-RU'); checklistForm.reset(); showScreen('checklist-screen'); }
    if(checklistForm) checklistForm.addEventListener('submit', async (e) => { e.preventDefault(); const user = auth.currentUser; if (!user || !currentCheckData) return; const photoFiles = document.getElementById('checklist-photos').files; const uploadPromises = Array.from(photoFiles).map(file => { const filePath = `reports/${user.uid}/${Date.now()}_${file.name}`; const fileRef = storage.ref(filePath); return fileRef.put(file).then(() => fileRef.getDownloadURL()); }); const imageUrls = await Promise.all(uploadPromises); const reportData = { userId: user.uid, slotId: currentCheckData.id, checkDate: new Date(), status: 'pending', imageUrls, locationName: currentCheckData.locationName, locationAddress: currentCheckData.locationAddress, answers: { q1_appearance: document.getElementById('checklist-q1-appearance').value, q2_cleanliness: document.getElementById('checklist-q2-cleanliness').value, q3_greeting: document.getElementById('checklist-q3-greeting').value, q4_upsell: document.getElementById('checklist-q4-upsell').value, q5_actions: document.getElementById('checklist-q5-actions').value, q6_handout: document.getElementById('checklist-q6-handout').value, q7_order_eval: document.getElementById('checklist-q7-order-eval').value, q8_food_rating: document.getElementById('checklist-q8-food-rating').value, q9_comments: document.getElementById('checklist-q9-comments').value, } }; await db.collection('reports').add(reportData); await db.collection('timeSlots').doc(currentCheckData.id).update({ status: 'завершен' }); showModal('Отчет отправлен!', `Спасибо! Мы свяжемся с вами по номеру ${user.phoneNumber} для возмещения средств.`); currentCheckData = null; loadUserDashboard(user.uid); showScreen('main-menu-screen'); });
    
    async function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = '<div class="spinner"></div>';
        const user = auth.currentUser; if (!user) return;
        const snapshot = await db.collection('reports').where('userId', '==', user.uid).orderBy('checkDate', 'desc').get();
        if (snapshot.empty) { historyList.innerHTML = '<p>Вы еще не отправляли ни одного отчета.</p>'; return; }
        let historyHTML = '';
        snapshot.forEach(doc => {
            const report = doc.data();
            const date = report.checkDate.toDate().toLocaleDateString('ru-RU');
            const statusText = { pending: 'в ожидании', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[report.status] || report.status;
            let commentHTML = '';
            if (report.status === 'rejected' && report.rejectionComment) {
                commentHTML = `<small class="rejection-comment"><b>Причина отклонения:</b> ${report.rejectionComment}</small>`;
            }
            historyHTML += `<li class="menu-list-item history-item"><div class="status-indicator ${report.status}"></div><div><strong>${report.locationName.replace(/^Б\d+\s*/, '')}</strong><small>Дата: ${date} - Статус: ${statusText}</small>${commentHTML}</div></li>`;
        });
        historyList.innerHTML = historyHTML;
    }

    // --- НАВИГАЦИЯ ---
    document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); const target = b.dataset.target; if (target === 'cooperation-screen') renderAvailableSchedules(); else if (target === 'history-screen') { renderHistory(); showScreen(target); } else showScreen(target); }));
    document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    document.querySelectorAll('.admin-hub-btn').forEach(b => b.addEventListener('click', () => { const target = b.dataset.target; if(target === 'admin-schedule-screen') { loadCitiesForAdmin(); } if(target === 'admin-reports-screen') renderAllReports(); if(target === 'admin-users-screen') renderAllUsers(); showScreen(target); }));
    if(viewScheduleBtn) viewScheduleBtn.addEventListener('click', () => { const targetScreen = document.getElementById('admin-view-schedule-screen'); if (targetScreen) { renderSchedules(); showScreen('admin-view-schedule-screen'); } });
});
