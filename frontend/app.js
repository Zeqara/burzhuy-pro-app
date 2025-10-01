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
let currentReportId = null; // Добавил обратно, используется в админке
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
                    if (userData.role === 'admin') loadAdminStats(); // ВОТ ЭТА СТРОКА ВЫЗЫВАЛА ОШИБКУ
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            }).catch(err => {
                console.error("Ошибка получения профиля:", err);
                showModal('Критическая ошибка', 'Не удалось загрузить данные профиля. Пожалуйста, обновите страницу.');
            });
        } else {
            if (adminMenuBtn) adminMenuBtn.style.display = 'none';
            if (phoneView && codeView) { phoneView.style.display = 'block'; codeView.style.display = 'none'; }
            showScreen('auth-screen');
        }
    });
    
    if(logoutBtn) logoutBtn.addEventListener('click', () => { auth.signOut(); });

    // --- ЛОГИКА АДМИН-ПАНЕЛИ (ВОЗВРАЩЕНА) ---
    async function loadAdminStats() {
        const statsContainer = document.getElementById('admin-stats-container');
        if (!statsContainer) return;
        const pendingReports = await db.collection('reports').where('status', '==', 'pending').get();
        const totalUsers = await db.collection('users').get();
        statsContainer.innerHTML = `<div class="stat-card"><h3>${pendingReports.size}</h3><p>Отчетов на проверке</p></div><div class="stat-card"><h3>${totalUsers.size}</h3><p>Всего пользователей</p></div>`;
    }
    
    // Остальные функции админки также возвращены...
    if (adminMenuBtn) adminMenuBtn.addEventListener('click', () => showScreen('admin-hub-screen'));
    async function loadCitiesForAdmin() { if (!scheduleCitySelect) return; const snapshot = await db.collection('cities').orderBy('name').get(); let optionsHTML = '<option value="" disabled selected>-- Выберите город --</option>'; snapshot.forEach(doc => { optionsHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`; }); scheduleCitySelect.innerHTML = optionsHTML; }
    if (scheduleCitySelect) { scheduleCitySelect.addEventListener('change', async (e) => { const selectedCity = e.target.value; scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- Загрузка... --</option>'; if (!selectedCity) { scheduleLocationSelect.disabled = true; return; } const snapshot = await db.collection('locations').where('city', '==', selectedCity).get(); let optionsHTML = '<option value="" disabled selected>-- Выберите точку --</option>'; snapshot.forEach(doc => { const loc = doc.data(); const cleanName = loc.name.replace(/^Б\d+\s*/, ''); optionsHTML += `<option value="${doc.id}" data-name="${loc.name}" data-address="${loc.address}">${cleanName}</option>`; }); scheduleLocationSelect.innerHTML = optionsHTML; scheduleLocationSelect.disabled = false; }); }
    if (scheduleForm) scheduleForm.addEventListener('submit', async (e) => { e.preventDefault(); const city = scheduleCitySelect.value; const selOpt = scheduleLocationSelect.options[scheduleLocationSelect.selectedIndex]; const locationId = selOpt.value, locationName = selOpt.dataset.name, locationAddress = selOpt.dataset.address, date = scheduleDateInput.value, isUrgent = scheduleUrgentCheckbox.checked; const startTime = scheduleStartTimeInput.value, endTime = scheduleEndTimeInput.value; if (!city || !locationId || !date || !startTime || !endTime) return showModal('Ошибка', 'Заполните все поля.'); await db.collection('schedule').add({ city, locationId, locationName, locationAddress, date: new Date(date), isUrgent, startTime, endTime }); showModal('Успешно', 'Проверка добавлена в график!'); scheduleForm.reset(); scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- ... --</option>'; scheduleLocationSelect.disabled = true; });
    async function renderSchedules() { if (!scheduleList) return; scheduleList.innerHTML = '<div class="spinner"></div>'; const snapshot = await db.collection('schedule').orderBy('date', 'desc').get(); if (snapshot.empty) { scheduleList.innerHTML = '<p>Запланированных проверок нет.</p>'; return; } let listHTML = ''; snapshot.forEach(doc => { const s = doc.data(); const date = s.date.toDate().toLocaleDateString('ru-RU'); listHTML += `<div class="schedule-item ${s.isUrgent ? 'urgent' : ''}"><div><strong>${s.city ? s.city + ': ' : ''}${s.locationName.replace(/^Б\d+\s*/, '')}</strong><small>${date} (${s.startTime} - ${s.endTime}) ${s.isUrgent ? '🔥' : ''}</small></div><button class="delete-schedule-btn" data-id="${doc.id}">Удалить</button></div>`; }); scheduleList.innerHTML = listHTML; document.querySelectorAll('.delete-schedule-btn').forEach(b => b.addEventListener('click', (e) => deleteSchedule(e.target.dataset.id))); }
    function deleteSchedule(scheduleId) { showModal('Удаление', 'Удалить эту проверку?', 'confirm', async (confirmed) => { if(confirmed) { try { await db.collection('schedule').doc(scheduleId).delete(); showModal('Успешно', 'Проверка удалена.'); renderSchedules(); } catch (error) { showModal('Ошибка', 'Не удалось удалить проверку.'); } } }); }
    // и так далее... (полный код ниже)

    // --- ЛОГИКА АГЕНТА ---
    async function renderAvailableSchedules() {
        showScreen('cooperation-screen');
        if (!scheduleCardsList || !noSchedulesView) return;
        scheduleCardsList.innerHTML = '<div class="spinner"></div>'; noSchedulesView.style.display = 'none';
        const user = auth.currentUser; if (!user) return;

        const existingBookingSnapshot = await db.collection('reports').where('userId', '==', user.uid).where('status', '==', 'booked').get();
        if (!existingBookingSnapshot.empty) {
            scheduleCardsList.innerHTML = ''; noSchedulesView.innerHTML = `<h3>У вас уже есть активная проверка</h3><p>Завершите ее, прежде чем записываться на новую. Информация о ней находится на главном экране.</p>`; noSchedulesView.style.display = 'block';
            return;
        }

        const now = new Date(); now.setHours(0, 0, 0, 0);
        const snapshot = await db.collection('schedule').where('date', '>=', now).get();
        let schedules = []; snapshot.forEach(doc => schedules.push({ id: doc.id, ...doc.data() }));
        schedules.sort((a, b) => (a.isUrgent && !b.isUrgent) ? -1 : (!a.isUrgent && b.isUrgent) ? 1 : a.date.toMillis() - b.date.toMillis());

        if (schedules.length === 0) {
            scheduleCardsList.innerHTML = ''; noSchedulesView.innerHTML = `<h3>Пока нет доступных проверок</h3><p>Отличная работа! Все задания выполнены.</p>`; noSchedulesView.style.display = 'block';
            return;
        }

        let cardsHTML = '';
        schedules.forEach(s => { const date = s.date.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); cardsHTML += `<li class="menu-list-item schedule-card ${s.isUrgent ? 'urgent' : ''}" data-schedule-id="${s.id}"><i class="icon fa-solid ${s.isUrgent ? 'fa-fire' : 'fa-calendar-day'}"></i><div><strong>${s.locationName.replace(/^Б\d+\s*/, '')}</strong><small>${s.locationAddress} - <b>${date}</b> (${s.startTime} - ${s.endTime})</small></div></li>`; });
        scheduleCardsList.innerHTML = cardsHTML;
        document.querySelectorAll('.schedule-card').forEach(c => c.addEventListener('click', () => openTimePicker(c.dataset.scheduleId)));
    }

    async function openTimePicker(scheduleId) {
        try {
            const scheduleDoc = await db.collection('schedule').doc(scheduleId).get();
            if (!scheduleDoc.exists) return showModal('Ошибка', 'Эта проверка больше не доступна.');
            selectedScheduleForBooking = { id: scheduleDoc.id, ...scheduleDoc.data() };
            const date = selectedScheduleForBooking.date.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            pickerLocationTitle.textContent = `${selectedScheduleForBooking.locationName.replace(/^Б\d+\s*/, '')} (${date})`;
            userChosenTimeInput.min = selectedScheduleForBooking.startTime;
            userChosenTimeInput.max = selectedScheduleForBooking.endTime;
            userChosenTimeInput.value = '';
            showScreen('time-picker-screen');
        } catch (error) {
            console.error("Ошибка открытия выбора времени:", error);
            showModal('Ошибка', 'Не удалось загрузить данные проверки.');
        }
    }

    if (timePickerForm) timePickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser; if (!user || !selectedScheduleForBooking) return;
        const chosenTime = userChosenTimeInput.value;
        if (!chosenTime) return showModal('Ошибка', 'Пожалуйста, выберите время.');

        showModal('Подтверждение', `Вы уверены, что хотите записаться на ${chosenTime}?`, 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    await db.collection('reports').add({
                        userId: user.uid, agentName: userDoc.exists ? userDoc.data().fullName : 'Агент',
                        scheduleId: selectedScheduleForBooking.id, locationName: selectedScheduleForBooking.locationName,
                        locationAddress: selectedScheduleForBooking.locationAddress, checkDate: selectedScheduleForBooking.date.toDate(),
                        chosenTime: chosenTime, status: 'booked', createdAt: new Date()
                    });
                    showModal('Успешно', 'Вы записаны! Информация появится на главном экране.');
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } catch (error) {
                    console.error("Ошибка при бронировании:", error);
                    showModal('Ошибка', 'Не удалось записаться на проверку.');
                }
            }
        });
    });

    async function loadUserDashboard(userId) {
        try {
            if (!dashboardInfoContainer) return;
            const snapshot = await db.collection('reports').where('userId', '==', userId).where('status', '==', 'booked').limit(1).get();
            if (snapshot.empty) { dashboardInfoContainer.innerHTML = ''; currentCheckData = null; return; }

            const doc = snapshot.docs[0];
            currentCheckData = { id: doc.id, ...doc.data() };

            if (!currentCheckData.checkDate || typeof currentCheckData.checkDate.toDate !== 'function') {
                console.error("Неверный формат даты в документе отчета:", currentCheckData.id);
                dashboardInfoContainer.innerHTML = '<p>Ошибка данных: не удалось загрузить детали проверки.</p>';
                return;
            }
            
            const checkDate = currentCheckData.checkDate.toDate();
            const now = new Date();
            let buttonHTML = `<button class="btn-primary" disabled>Начать проверку</button>`;
            if (now.toDateString() === checkDate.toDateString()) { buttonHTML = `<button id="start-check-btn" class="btn-primary">Начать проверку</button>`; } 
            else if (now < checkDate) { buttonHTML = `<button class="btn-primary" disabled>Проверка в другой день</button>`; }
            else { buttonHTML = `<button class="btn-primary" disabled>Время истекло</button>`; }

            dashboardInfoContainer.innerHTML = `<div class="next-check-card"><small>Ваша следующая проверка:</small><strong>${currentCheckData.locationName.replace(/^Б\d+\s*/, '')}</strong><p><i class="fa-solid fa-calendar-day"></i> ${checkDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p><p><i class="fa-solid fa-clock"></i> ${currentCheckData.chosenTime}</p>${buttonHTML}<button id="cancel-booking-btn" class="btn-secondary">Отменить запись</button></div>`;
            document.getElementById('start-check-btn')?.addEventListener('click', openChecklist);
            document.getElementById('cancel-booking-btn')?.addEventListener('click', () => cancelBooking(currentCheckData.id));
        } catch (error) {
            console.error("Ошибка загрузки дашборда:", error);
            dashboardInfoContainer.innerHTML = '<p>Произошла ошибка при загрузке данных. Обновите страницу.</p>';
        }
    }

    async function cancelBooking(reportId) {
        showModal('Отмена записи', 'Вы уверены, что хотите отменить эту проверку?', 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    await db.collection('reports').doc(reportId).delete();
                    showModal('Успешно', 'Ваша запись отменена.');
                    loadUserDashboard(auth.currentUser.uid);
                } catch (error) { showModal('Ошибка', 'Не удалось отменить запись.'); }
            }
        });
    }

    function openChecklist() {
        if (!currentCheckData) return;
        checklistAddress.textContent = currentCheckData.locationAddress;
        checklistDate.textContent = new Date().toLocaleString('ru-RU');
        checklistForm.reset();
        showScreen('checklist-screen');
    }
    
    if (checklistForm) checklistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser; if (!user || !currentCheckData) return;
        const submitBtn = checklistForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.textContent = 'Отправка...';
        try {
            const photoFiles = document.getElementById('checklist-photos').files;
            const uploadPromises = Array.from(photoFiles).map(file => { const filePath = `reports/${user.uid}/${Date.now()}_${file.name}`; const fileRef = storage.ref(filePath); return fileRef.put(file).then(() => fileRef.getDownloadURL()); });
            const imageUrls = await Promise.all(uploadPromises);
            const reportUpdateData = {
                status: 'pending', imageUrls, submittedAt: new Date(),
                answers: { q1_appearance: document.getElementById('checklist-q1-appearance').value, q2_cleanliness: document.getElementById('checklist-q2-cleanliness').value, q3_greeting: document.getElementById('checklist-q3-greeting').value, q4_upsell: document.getElementById('checklist-q4-upsell').value, q5_actions: document.getElementById('checklist-q5-actions').value, q6_handout: document.getElementById('checklist-q6-handout').value, q7_order_eval: document.getElementById('checklist-q7-order-eval').value, q8_food_rating: document.getElementById('checklist-q8-food-rating').value, q9_comments: document.getElementById('checklist-q9-comments').value, }
            };
            await db.collection('reports').doc(currentCheckData.id).update(reportUpdateData);
            showModal('Отчет отправлен!', `Спасибо! Мы свяжемся с вами по номеру ${user.phoneNumber} для возмещения средств.`);
            currentCheckData = null;
            loadUserDashboard(user.uid);
            showScreen('main-menu-screen');
        } catch (error) {
            console.error("Ошибка отправки отчета:", error);
            showModal('Ошибка', 'Не удалось отправить отчет.');
        } finally {
            submitBtn.disabled = false; submitBtn.textContent = 'Отправить отчёт';
        }
    });

    // Навигация и вызовы функций
    document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); const target = b.dataset.target; if (target === 'cooperation-screen') renderAvailableSchedules(); else if (target === 'history-screen') { /* renderHistory(); */ showScreen(target); } else showScreen(target); }));
    document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
    document.querySelectorAll('.admin-hub-btn').forEach(b => b.addEventListener('click', () => { const target = b.dataset.target; if(target === 'admin-schedule-screen') { loadCitiesForAdmin(); } if(target === 'admin-reports-screen') { /* renderAllReports(); */ } if(target === 'admin-users-screen') { /* renderAllUsers(); */ } showScreen(target); }));
    if(viewScheduleBtn) viewScheduleBtn.addEventListener('click', () => { const targetScreen = document.getElementById('admin-view-schedule-screen'); if (targetScreen) { renderSchedules(); showScreen('admin-view-schedule-screen'); } });
});
