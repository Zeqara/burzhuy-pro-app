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
    const adminMenuBtn = document.getElementById('admin-menu-btn'); // <-- Находим новую кнопку
    const scheduleForm = document.getElementById('schedule-form'), scheduleLocationSelect = document.getElementById('schedule-location-select'), scheduleDateInput = document.getElementById('schedule-date-input'), timeSlotsContainer = document.getElementById('time-slots-container'), addSlotBtn = document.getElementById('add-slot-btn'), scheduleUrgentCheckbox = document.getElementById('schedule-urgent-checkbox'), scheduleList = document.getElementById('schedule-list');
    const scheduleCardsList = document.getElementById('schedule-cards-list'), noSchedulesView = document.getElementById('no-schedules-view'), lottieAnimationContainer = document.getElementById('lottie-animation'), slotsList = document.getElementById('slots-list'), slotLocationTitle = document.getElementById('slot-location-title');
    const dashboardInfoContainer = document.getElementById('dashboard-info-container');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');

    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });

    if(lottieAnimationContainer) {
        lottie.loadAnimation({ container: lottieAnimationContainer, renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' });
    }

    // --- АУТЕНТИФИКАЦИЯ ---
    if(phoneForm) phoneForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let rawPhoneNumber = phoneInput.value, digitsOnly = rawPhoneNumber.replace(/\D/g, '');
        if (digitsOnly.startsWith('8')) digitsOnly = '7' + digitsOnly.substring(1);
        const formattedPhoneNumber = `+${digitsOnly}`;
        if (digitsOnly.length < 11) return alert('Пожалуйста, введите полный номер телефона.');
        sendCodeBtn.disabled = true; sendCodeBtn.textContent = 'Отправка...';
        auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier)
            .then(result => { confirmationResult = result; phoneView.style.display = 'none'; codeView.style.display = 'block'; alert('СМС-код отправлен на ваш номер.'); })
            .catch(err => { console.error("Firebase Error:", err); alert(`Произошла ошибка: \nКод: ${err.code}\nСообщение: ${err.message}`); })
            .finally(() => { sendCodeBtn.disabled = false; sendCodeBtn.textContent = 'Получить код'; });
    });

    if(codeForm) codeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = codeInput.value;
        if (!code || !confirmationResult) return;
        confirmationResult.confirm(code).catch(err => alert(`Неверный код.`));
    });

    if(profileSetupForm) profileSetupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = auth.currentUser, fullName = profileNameInput.value.trim();
        if (!user || !fullName) return;
        db.collection('users').doc(user.uid).set({ fullName: fullName, phone: user.phoneNumber, role: 'guest' })
            .then(() => { userNameDisplay.textContent = fullName; showScreen('main-menu-screen'); })
            .catch(err => alert(`Не удалось сохранить профиль.`));
    });

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    userNameDisplay.textContent = userData.fullName;
                    if (userData.role === 'admin') {
                        adminMenuBtn.style.display = 'flex';
                    } else {
                        adminMenuBtn.style.display = 'none';
                    }
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            });
        } else {
            adminMenuBtn.style.display = 'none'; // Скрываем кнопку при выходе
            if(phoneView && codeView) { phoneView.style.display = 'block'; codeView.style.display = 'none'; }
            showScreen('auth-screen');
        }
    });
    
    if(logoutBtn) logoutBtn.addEventListener('click', () => {
        if(dashboardUpdateInterval) clearInterval(dashboardUpdateInterval);
        auth.signOut();
    });

    // --- ЛОГИКА АДМИН-ПАНЕЛИ ---
    if (adminMenuBtn) {
        adminMenuBtn.addEventListener('click', () => { 
            loadLocationsForAdmin(); 
            renderSchedules(); 
            showScreen('admin-schedule-screen'); 
        });
    }

    async function loadLocationsForAdmin() {
        if (!scheduleLocationSelect) return;
        const snapshot = await db.collection('locations').get();
        let optionsHTML = '<option value="" disabled selected>-- Выберите точку --</option>';
        snapshot.forEach(doc => { const loc = doc.data(); optionsHTML += `<option value="${doc.id}" data-name="${loc.name}" data-address="${loc.address}">${loc.name} (${loc.address})</option>`; });
        scheduleLocationSelect.innerHTML = optionsHTML;
    }

    function addSlotInput() {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'time-slot-input';
        slotDiv.innerHTML = `<input type="time" class="slot-start" required> - <input type="time" class="slot-end" required><button type="button" class="remove-slot-btn">×</button>`;
        if(timeSlotsContainer) timeSlotsContainer.appendChild(slotDiv);
        slotDiv.querySelector('.remove-slot-btn').addEventListener('click', () => slotDiv.remove());
    }
    if(addSlotBtn) { addSlotBtn.addEventListener('click', addSlotInput); addSlotInput(); }

    if(scheduleForm) scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selOpt = scheduleLocationSelect.options[scheduleLocationSelect.selectedIndex];
        const locationId = selOpt.value, locationName = selOpt.dataset.name, locationAddress = selOpt.dataset.address, date = scheduleDateInput.value, isUrgent = scheduleUrgentCheckbox.checked;
        const timeSlots = Array.from(document.querySelectorAll('.time-slot-input')).map(s => ({ start: s.querySelector('.slot-start').value, end: s.querySelector('.slot-end').value })).filter(ts => ts.start && ts.end);
        if (!locationId || !date || timeSlots.length === 0) return alert('Заполните все поля.');
        const scheduleDocRef = await db.collection('schedule').add({ locationId, locationName, locationAddress, date: new Date(date), isUrgent });
        const batch = db.batch();
        timeSlots.forEach(slot => { const slotDocRef = db.collection('timeSlots').doc(); batch.set(slotDocRef, { scheduleId: scheduleDocRef.id, startTime: slot.start, endTime: slot.end, status: 'свободен', bookedBy: null, agentName: null }); });
        await batch.commit();
        alert('Проверка добавлена!');
        scheduleForm.reset(); timeSlotsContainer.innerHTML = ''; addSlotInput(); renderSchedules();
    });

    async function renderSchedules() {
        if (!scheduleList) return;
        scheduleList.innerHTML = '<div class="spinner"></div>';
        const snapshot = await db.collection('schedule').orderBy('date', 'desc').get();
        if(snapshot.empty) { scheduleList.innerHTML = '<p>Запланированных проверок пока нет.</p>'; return; }
        let listHTML = '';
        snapshot.forEach(doc => {
            const s = doc.data();
            const date = s.date.toDate().toLocaleDateString('ru-RU');
            listHTML += `<div class="schedule-item ${s.isUrgent ? 'urgent' : ''}"><div><strong>${s.locationName}</strong><small>${date} ${s.isUrgent ? '🔥' : ''}</small></div><button class="delete-schedule-btn" data-id="${doc.id}">Удалить</button></div>`;
        });
        scheduleList.innerHTML = listHTML;
        document.querySelectorAll('.delete-schedule-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const scheduleId = e.target.dataset.id;
                if (confirm('Вы уверены, что хотите удалить эту проверку и все связанные с ней временные слоты?')) {
                    await deleteSchedule(scheduleId);
                }
            });
        });
    }

    async function deleteSchedule(scheduleId) {
        try {
            await db.collection('schedule').doc(scheduleId).delete();
            const slotsSnapshot = await db.collection('timeSlots').where('scheduleId', '==', scheduleId).get();
            const batch = db.batch();
            slotsSnapshot.forEach(doc => { batch.delete(doc.ref); });
            await batch.commit();
            alert('Проверка успешно удалена.');
            renderSchedules();
        } catch (error) {
            console.error('Ошибка удаления проверки:', error);
            alert('Не удалось удалить проверку.');
        }
    }

    // --- ЛОГИКА АГЕНТА: ЗАПИСЬ НА ПРОВЕРКУ ---
    async function renderAvailableSchedules() {
        showScreen('cooperation-screen');
        if (!scheduleCardsList || !noSchedulesView) return;
        scheduleCardsList.innerHTML = '<div class="spinner"></div>';
        noSchedulesView.style.display = 'none';

        const user = auth.currentUser;
        if (!user) return;
        const existingBookingSnapshot = await db.collection('timeSlots').where('bookedBy', '==', user.uid).where('status', '==', 'забронирован').get();
        if (!existingBookingSnapshot.empty) {
            scheduleCardsList.innerHTML = '';
            noSchedulesView.innerHTML = `<div id="lottie-animation-booked"></div><h3>У вас уже есть активная проверка</h3><p>Завершите ее, прежде чем записываться на новую. Информация о ней находится на главном экране.</p>`;
            noSchedulesView.style.display = 'block';
            if (document.getElementById('lottie-animation-booked')) {
                lottie.loadAnimation({ container: document.getElementById('lottie-animation-booked'), renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' });
            }
            return;
        }

        const now = new Date(); now.setHours(0,0,0,0);
        const snapshot = await db.collection('schedule').where('date', '>=', now).get();
        const schedules = [];
        snapshot.forEach(doc => schedules.push({ id: doc.id, ...doc.data() }));
        schedules.sort((a, b) => (a.isUrgent && !b.isUrgent) ? -1 : (!a.isUrgent && b.isUrgent) ? 1 : a.date.toMillis() - b.date.toMillis());

        if (schedules.length === 0) {
            scheduleCardsList.innerHTML = '';
            noSchedulesView.innerHTML = `<div id="lottie-animation"></div><h3>Пока нет доступных проверок</h3><p>Отличная работа! Все задания выполнены.</p>`;
            noSchedulesView.style.display = 'block';
             if (document.getElementById('lottie-animation')) {
                lottie.loadAnimation({ container: document.getElementById('lottie-animation'), renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' });
            }
            return;
        }
        
        let cardsHTML = '';
        schedules.forEach(s => {
            const date = s.date.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
            cardsHTML += `<li class="menu-list-item schedule-card ${s.isUrgent ? 'urgent' : ''}" data-schedule-id="${s.id}" data-location-title="${s.locationName} (${date})"><i class="icon fa-solid ${s.isUrgent ? 'fa-fire' : 'fa-calendar-day'}"></i><div><strong>${s.locationName}</strong><small>${s.locationAddress} - <b>${date}</b></small></div></li>`;
        });
        scheduleCardsList.innerHTML = cardsHTML;
        document.querySelectorAll('.schedule-card').forEach(c => c.addEventListener('click', () => renderTimeSlots(c.dataset.scheduleId, c.dataset.locationTitle)));
    }

    async function renderTimeSlots(scheduleId, locationTitle) {
        showScreen('time-slots-screen');
        if (!slotsList || !slotLocationTitle) return;
        slotLocationTitle.textContent = locationTitle;
        slotsList.innerHTML = '<div class="spinner"></div>';
        
        const snapshot = await db.collection('timeSlots').where('scheduleId', '==', scheduleId).where('status', '==', 'свободен').get();
        if (snapshot.empty) { slotsList.innerHTML = '<p>К сожалению, все свободные места на эту дату уже заняты.</p>'; return; }
        
        let slotsHTML = '';
        snapshot.forEach(doc => { const s = doc.data(); slotsHTML += `<li class="menu-list-item time-slot" data-slot-id="${doc.id}"><i class="icon fa-solid fa-clock"></i><div><strong>${s.startTime} - ${s.endTime}</strong></div></li>`; });
        slotsList.innerHTML = slotsHTML;
        document.querySelectorAll('.time-slot').forEach(s => s.addEventListener('click', async () => {
            if (!confirm('Вы уверены, что хотите записаться на это время?')) return;
            const user = auth.currentUser; if (!user) return;
            const userDoc = await db.collection('users').doc(user.uid).get();
            await db.collection('timeSlots').doc(s.dataset.slotId).update({ status: 'забронирован', bookedBy: user.uid, agentName: userDoc.data().fullName });
            alert('Вы успешно записаны!');
            loadUserDashboard(user.uid);
            showScreen('main-menu-screen');
        }));
    }

    // --- УМНЫЙ ДАШБОРД И ЧЕК-ЛИСТ ---
    let dashboardUpdateInterval = null;
    async function loadUserDashboard(userId) {
        if (!dashboardInfoContainer) return;
        if (dashboardUpdateInterval) clearInterval(dashboardUpdateInterval);
        
        const snapshot = await db.collection('timeSlots').where('bookedBy', '==', userId).where('status', '==', 'забронирован').limit(1).get();
        if (snapshot.empty) { dashboardInfoContainer.innerHTML = ''; return; }

        const doc = snapshot.docs[0];
        const booking = { id: doc.id, ...doc.data() };
        const scheduleDoc = await db.collection('schedule').doc(booking.scheduleId).get();
        const schedule = scheduleDoc.data();
        currentCheckData = { ...booking, ...schedule };

        function updateDashboard() {
            const checkDate = schedule.date.toDate();
            const [startHour, startMinute] = booking.startTime.split(':');
            const [endHour, endMinute] = booking.endTime.split(':');
            const startTime = new Date(checkDate.getTime()); startTime.setHours(startHour, startMinute, 0, 0);
            const endTime = new Date(checkDate.getTime()); endTime.setHours(endHour, endMinute, 0, 0);
            const now = new Date();
            let buttonHTML;

            if (now >= startTime && now <= endTime) {
                buttonHTML = `<button id="start-check-btn" class="btn-primary">Начать проверку</button>`;
            } else if (now < startTime) {
                const diff = startTime - now, hours = Math.floor(diff / 3600000), minutes = Math.floor((diff % 3600000) / 60000);
                buttonHTML = `<button class="btn-primary" disabled>Начнется через ${hours} ч ${minutes} мин</button>`;
            } else {
                buttonHTML = `<button class="btn-primary" disabled>Время проверки истекло</button>`;
            }

            dashboardInfoContainer.innerHTML = `<div class="next-check-card"><small>Ваша следующая проверка:</small><strong>${schedule.locationName}</strong><p><i class="fa-solid fa-calendar-day"></i> ${checkDate.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})}</p><p><i class="fa-solid fa-clock"></i> ${booking.startTime} - ${booking.endTime}</p>${buttonHTML}</div>`;
            const startCheckBtn = document.getElementById('start-check-btn');
            if (startCheckBtn) startCheckBtn.addEventListener('click', openChecklist);
        }
        updateDashboard();
        dashboardUpdateInterval = setInterval(updateDashboard, 60000);
    }

    function openChecklist() {
        if (!currentCheckData) return;
        checklistAddress.textContent = currentCheckData.locationAddress;
        checklistDate.textContent = new Date().toLocaleString('ru-RU');
        checklistForm.reset();
        showScreen('checklist-screen');
    }
    
    if(checklistForm) checklistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !currentCheckData) return;
        const photoFiles = document.getElementById('checklist-photos').files;
        const uploadPromises = Array.from(photoFiles).map(file => {
            const filePath = `reports/${user.uid}/${Date.now()}_${file.name}`;
            const fileRef = storage.ref(filePath);
            return fileRef.put(file).then(() => fileRef.getDownloadURL());
        });
        const imageUrls = await Promise.all(uploadPromises);
        const reportData = { userId: user.uid, slotId: currentCheckData.id, checkDate: new Date(), status: 'pending', imageUrls, answers: { q1_appearance: document.getElementById('checklist-q1-appearance').value, q2_cleanliness: document.getElementById('checklist-q2-cleanliness').value, q3_greeting: document.getElementById('checklist-q3-greeting').value, q4_upsell: document.getElementById('checklist-q4-upsell').value, q5_actions: document.getElementById('checklist-q5-actions').value, q6_handout: document.getElementById('checklist-q6-handout').value, q7_order_eval: document.getElementById('checklist-q7-order-eval').value, q8_food_rating: document.getElementById('checklist-q8-food-rating').value, q9_comments: document.getElementById('checklist-q9-comments').value, } };
        await db.collection('reports').add(reportData);
        await db.collection('timeSlots').doc(currentCheckData.id).update({ status: 'завершен' });
        alert('Спасибо за ваш отчёт ✅');
        currentCheckData = null;
        loadUserDashboard(user.uid);
        showScreen('main-menu-screen');
    });

    // --- НАВИГАЦИЯ ---
    const menuButtons = document.querySelectorAll('.menu-btn');
    menuButtons.forEach(b => b.addEventListener('click', (e) => {
        e.preventDefault();
        const target = b.dataset.target;
        if (target === 'cooperation-screen') renderAvailableSchedules(); else showScreen(target);
    }));
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
});
