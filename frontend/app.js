// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let confirmationResult = null;

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
    // DOM Элементы для аутентификации
    const phoneForm = document.getElementById('phone-form');
    const phoneInput = document.getElementById('phone-input');
    const sendCodeBtn = document.getElementById('send-code-btn');
    const codeForm = document.getElementById('code-form');
    const codeInput = document.getElementById('code-input');
    const phoneView = document.getElementById('phone-view');
    const codeView = document.getElementById('code-view');
    const profileSetupForm = document.getElementById('profile-setup-form');
    const profileNameInput = document.getElementById('profile-name-input');
    const userNameDisplay = document.getElementById('user-name-display');
    const logoutBtn = document.getElementById('logout-btn');

    // DOM Элементы для админ-панели
    const adminMenuContainer = document.getElementById('admin-menu-container');
    const scheduleForm = document.getElementById('schedule-form');
    const scheduleLocationSelect = document.getElementById('schedule-location-select');
    const scheduleDateInput = document.getElementById('schedule-date-input');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const addSlotBtn = document.getElementById('add-slot-btn');
    const scheduleUrgentCheckbox = document.getElementById('schedule-urgent-checkbox');
    const scheduleList = document.getElementById('schedule-list');

    let currentUserRole = 'guest';

    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });

    // ЛОГИКА АУТЕНТИФИКАЦИИ ПО ТЕЛЕФОНУ
    if(phoneForm) {
        phoneForm.addEventListener('submit', (e) => {
            e.preventDefault();
            let rawPhoneNumber = phoneInput.value;
            let digitsOnly = rawPhoneNumber.replace(/\D/g, '');
            if (digitsOnly.startsWith('8')) {
                digitsOnly = '7' + digitsOnly.substring(1);
            }
            const formattedPhoneNumber = `+${digitsOnly}`;
            if (digitsOnly.length < 11) {
                alert('Пожалуйста, введите полный номер телефона.');
                return;
            }
            sendCodeBtn.disabled = true;
            sendCodeBtn.textContent = 'Отправка...';
            auth.signInWithPhoneNumber(formattedPhoneNumber, recaptchaVerifier)
                .then(result => {
                    confirmationResult = result;
                    phoneView.style.display = 'none';
                    codeView.style.display = 'block';
                    alert('СМС-код отправлен на ваш номер.');
                })
                .catch(err => {
                    console.error("Firebase Error:", err);
                    alert(`Произошла ошибка: \nКод: ${err.code}\nСообщение: ${err.message}`);
                })
                .finally(() => {
                    sendCodeBtn.disabled = false;
                    sendCodeBtn.textContent = 'Получить код';
                });
        });
    }

    if(codeForm) {
        codeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = codeInput.value;
            if (!code) return alert('Введите код из СМС');
            if (!confirmationResult) return alert('Сначала запросите код.');
            confirmationResult.confirm(code)
                .catch(err => alert(`Неверный код. Попробуйте еще раз.`));
        });
    }
    
    if(profileSetupForm) {
        profileSetupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const fullName = profileNameInput.value.trim();
            if (!user || !fullName) return alert('Введите ваше имя и фамилию.');
            db.collection('users').doc(user.uid).set({
                fullName: fullName,
                phone: user.phoneNumber,
                role: 'guest'
            }).then(() => {
                userNameDisplay.textContent = fullName;
                showScreen('main-menu-screen');
            }).catch(err => alert(`Не удалось сохранить профиль: ${err.message}`));
        });
    }

    // ГЛАВНЫЙ КОНТРОЛЛЕР
    auth.onAuthStateChanged(user => {
        if (user) {
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    currentUserRole = userData.role || 'guest';
                    userNameDisplay.textContent = userData.fullName;
                    setupAdminUI();
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            });
        } else {
            currentUserRole = 'guest';
            setupAdminUI();
            if(phoneView && codeView && phoneForm && codeForm) {
                phoneView.style.display = 'block';
                codeView.style.display = 'none';
                phoneForm.reset();
                codeForm.reset();
            }
            showScreen('auth-screen');
        }
    });

    if(logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });

    // ЛОГИКА АДМИН-ПАНЕЛИ
    function setupAdminUI() {
        if (!adminMenuContainer) return;
        adminMenuContainer.innerHTML = '';
        if (currentUserRole === 'admin') {
            const adminButton = document.createElement('li');
            adminButton.className = 'menu-list-item menu-btn';
            adminButton.dataset.target = 'admin-schedule-screen';
            adminButton.innerHTML = `<i class="icon fa-solid fa-user-shield"></i><div><strong>Панель Администратора</strong><small>Управление графиком проверок</small></div>`;
            adminButton.addEventListener('click', () => {
                loadLocationsForAdmin();
                renderSchedules();
                showScreen('admin-schedule-screen');
            });
            adminMenuContainer.appendChild(adminButton);
        }
    }

    async function loadLocationsForAdmin() {
        if (!scheduleLocationSelect) return;
        scheduleLocationSelect.innerHTML = '<option value="">Загрузка...</option>';
        try {
            const snapshot = await db.collection('locations').get();
            if (snapshot.empty) {
                scheduleLocationSelect.innerHTML = '<option value="">Нет доступных локаций</option>';
                return;
            }
            let optionsHTML = '<option value="" disabled selected>-- Выберите точку --</option>';
            snapshot.forEach(doc => {
                const location = doc.data();
                optionsHTML += `<option value="${doc.id}" data-name="${location.name}" data-address="${location.address}">${location.name} (${location.address})</option>`;
            });
            scheduleLocationSelect.innerHTML = optionsHTML;
        } catch (error) {
            console.error("Ошибка загрузки локаций:", error);
            scheduleLocationSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
        }
    }

    let slotCounter = 0;
    function addSlotInput() {
        slotCounter++;
        const slotDiv = document.createElement('div');
        slotDiv.className = 'time-slot-input';
        slotDiv.innerHTML = `<input type="time" class="slot-start" required> - <input type="time" class="slot-end" required><button type="button" class="remove-slot-btn">×</button>`;
        if(timeSlotsContainer) timeSlotsContainer.appendChild(slotDiv);
        slotDiv.querySelector('.remove-slot-btn').addEventListener('click', () => slotDiv.remove());
    }

    if(addSlotBtn) {
        addSlotBtn.addEventListener('click', addSlotInput);
        addSlotInput();
    }

    if(scheduleForm) {
        scheduleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const selectedOption = scheduleLocationSelect.options[scheduleLocationSelect.selectedIndex];
            const locationId = selectedOption.value;
            const locationName = selectedOption.dataset.name;
            const locationAddress = selectedOption.dataset.address;
            const date = scheduleDateInput.value;
            const isUrgent = scheduleUrgentCheckbox.checked;

            const timeSlots = [];
            document.querySelectorAll('.time-slot-input').forEach(slot => {
                const start = slot.querySelector('.slot-start').value;
                const end = slot.querySelector('.slot-end').value;
                if (start && end) timeSlots.push({ startTime: start, endTime: end });
            });

            if (!locationId || !date || timeSlots.length === 0) {
                alert('Заполните все поля и добавьте хотя бы один временной слот.');
                return;
            }

            try {
                const scheduleDocRef = await db.collection('schedule').add({ locationId, locationName, locationAddress, date: new Date(date), isUrgent });
                const batch = db.batch();
                timeSlots.forEach(slot => {
                    const slotDocRef = db.collection('timeSlots').doc();
                    batch.set(slotDocRef, { scheduleId: scheduleDocRef.id, startTime: slot.startTime, endTime: slot.endTime, status: 'свободен', bookedBy: null, agentName: null });
                });
                await batch.commit();
                alert('Проверка успешно добавлена в график!');
                scheduleForm.reset();
                timeSlotsContainer.innerHTML = '';
                addSlotInput();
                renderSchedules();
            } catch (error) {
                console.error("Ошибка сохранения графика:", error);
                alert('Не удалось сохранить проверку.');
            }
        });
    }

    async function renderSchedules() {
        if (!scheduleList) return;
        scheduleList.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('schedule').orderBy('date', 'desc').get();
            if (snapshot.empty) {
                scheduleList.innerHTML = '<p>Запланированных проверок пока нет.</p>';
                return;
            }
            let listHTML = '';
            snapshot.forEach(doc => {
                const schedule = doc.data();
                const date = schedule.date.toDate().toLocaleDateString('ru-RU');
                const urgentClass = schedule.isUrgent ? 'urgent' : '';
                listHTML += `<div class="schedule-item ${urgentClass}"><strong>${schedule.locationName}</strong><small>${date} ${schedule.isUrgent ? '🔥' : ''}</small></div>`;
            });
            scheduleList.innerHTML = listHTML;
        } catch (error) {
            console.error("Ошибка загрузки графика:", error);
            scheduleList.innerHTML = '<p>Не удалось загрузить список проверок.</p>';
        }
    }

    // НАВИГАЦИЯ ПО МЕНЮ
    const menuButtons = document.querySelectorAll('.menu-btn');
    menuButtons.forEach(b => b.addEventListener('click', () => { const id = b.dataset.target; showScreen(id); }));
    
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
});
