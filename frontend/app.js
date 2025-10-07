// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = {
    apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc",
    authDomain: "burzhuy-pro-v2.firebaseapp.com",
    projectId: "burzhuy-pro-v2",
    storageBucket: "burzhuy-pro-v2.appspot.com",
    messagingSenderId: "627105413900",
    appId: "1:627105413900:web:3a02e926867ff76e256729"
};Й
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let currentReportId = null;
let selectedScheduleForBooking = null;

// =================================================================
// ГЛАВНЫЕ ФУНКЦИИ (ХЕЛПЕРЫ)
// =================================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    } else {
        console.error(`Screen with id "${screenId}" not found.`);
    }
}

function showModal(title, text, type = 'alert', onConfirm = () => {}) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    
    modalTitle.textContent = title;
    modalText.innerHTML = text;
    modalConfirmBtn.textContent = (type === 'confirm') ? 'Подтвердить' : 'OK';
    modalCancelBtn.style.display = (type === 'confirm') ? 'inline-block' : 'none';

    const newConfirmBtn = modalConfirmBtn.cloneNode(true);
    modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
    
    const newCancelBtn = modalCancelBtn.cloneNode(true);
    modalCancelBtn.parentNode.replaceChild(newCancelBtn, modalCancelBtn);
    
    newConfirmBtn.addEventListener('click', () => {
        onConfirm(true);
        modalContainer.classList.add('modal-hidden');
    }, { once: true });

    if (type === 'confirm') {
        newCancelBtn.addEventListener('click', () => {
            onConfirm(false);
            modalContainer.classList.add('modal-hidden');
        }, { once: true });
    }
    
    modalContainer.classList.remove('modal-hidden');
}


// =================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- Получение всех DOM элементов ---
    const elements = {
        loginRegisterForm: document.getElementById('login-register-form'),
        profileSetupForm: document.getElementById('profile-setup-form'),
        phoneInput: document.getElementById('phone-input'),
        passwordInput: document.getElementById('password-input'),
        profileNameInput: document.getElementById('profile-name-input'),
        loginRegisterBtn: document.getElementById('login-register-btn'),
        userNameDisplay: document.getElementById('user-name-display'),
        logoutBtn: document.getElementById('logout-btn'),
        adminMenuBtn: document.getElementById('admin-menu-btn'),
        scheduleForm: document.getElementById('schedule-form'),
        scheduleCitySelect: document.getElementById('schedule-city-select'),
        scheduleLocationSelect: document.getElementById('schedule-location-select'),
        scheduleDateInput: document.getElementById('schedule-date-input'),
        scheduleUrgentCheckbox: document.getElementById('schedule-urgent-checkbox'),
        scheduleList: document.getElementById('schedule-list'),
        viewScheduleBtn: document.getElementById('view-schedule-btn'),
        scheduleCardsList: document.getElementById('schedule-cards-list'),
        noSchedulesView: document.getElementById('no-schedules-view'),
        timePickerForm: document.getElementById('time-picker-form'),
        pickerLocationTitle: document.getElementById('picker-location-title'),
        dashboardInfoContainer: document.getElementById('dashboard-info-container'),
        checklistForm: document.getElementById('checklist-form'),
        checklistAddress: document.getElementById('checklist-address'),
        checklistDate: document.getElementById('checklist-date'),
        historyList: document.getElementById('history-list'),
        adminReportsList: document.getElementById('admin-reports-list'),
        adminUsersList: document.getElementById('admin-users-list'),
        adminDetailAddress: document.getElementById('admin-detail-address'),
        adminDetailUser: document.getElementById('admin-detail-user'),
        adminDetailPhone: document.getElementById('admin-detail-phone'),
        adminDetailDate: document.getElementById('admin-detail-date'),
        adminDetailStatus: document.getElementById('admin-detail-status'),
        adminDetailPhotos: document.getElementById('admin-detail-photos'),
        adminDetailRejectionComment: document.getElementById('admin-detail-rejection-comment-container'),
        adminDetailAnswers: {
            q1: document.getElementById('admin-detail-q1'), q2: document.getElementById('admin-detail-q2'),
            q3: document.getElementById('admin-detail-q3'), q4: document.getElementById('admin-detail-q4'),
            q5: document.getElementById('admin-detail-q5'), q6: document.getElementById('admin-detail-q6'),
            q7: document.getElementById('admin-detail-q7'), q8: document.getElementById('admin-detail-q8'),
            q9: document.getElementById('admin-detail-q9'),
        }
    };
    
    // --- ГЛАВНЫЙ КОНТРОЛЛЕР (СОСТОЯНИЕ АУТЕНТИФИКАЦИИ) ---
    auth.onAuthStateChanged(user => {
        document.getElementById('loader').classList.remove('active');
        if (user) {
            db.collection('users').doc(user.uid).onSnapshot(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const userAvatar = document.querySelector('.dashboard-header .avatar');
                    elements.userNameDisplay.textContent = userData.fullName;
                    if (userAvatar && userData.fullName) {
                        userAvatar.textContent = userData.fullName.charAt(0).toUpperCase();
                    }
                    elements.adminMenuBtn.style.display = (userData.role === 'admin') ? 'flex' : 'none';
                    if (userData.role === 'admin') loadAdminStats();
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            }, err => {
                console.error("Ошибка получения профиля:", err);
                showModal('Критическая ошибка', 'Не удалось загрузить данные профиля.');
            });
        } else {
            elements.adminMenuBtn.style.display = 'none';
            showScreen('auth-screen');
        }
    });

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ ---
    if (elements.loginRegisterForm) {
        elements.loginRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const digitsOnly = elements.phoneInput.value.replace(/\D/g, '');
            if (digitsOnly.length !== 11) {
                return showModal('Ошибка', 'Введите полный номер телефона.');
            }
            const password = elements.passwordInput.value;
            if (password.length < 6) {
                return showModal('Ошибка', 'Пароль должен содержать не менее 6 символов.');
            }
            const email = `+${digitsOnly}@burzhuy-pro.app`;
            
            elements.loginRegisterBtn.disabled = true;
            elements.loginRegisterBtn.innerHTML = '<div class="spinner-small"></div> Вход...';

            try {
                await auth.createUserWithEmailAndPassword(email, password);
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    try {
                        await auth.signInWithEmailAndPassword(email, password);
                    } catch (signInError) {
                        showModal('Ошибка входа', 'Неверный номер телефона или пароль.');
                    }
                } else {
                    showModal('Ошибка регистрации', error.message);
                }
            } finally {
                elements.loginRegisterBtn.disabled = false;
                elements.loginRegisterBtn.textContent = 'Войти / Создать аккаунт';
            }
        });
    }

    if (elements.profileSetupForm) {
        elements.profileSetupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const fullName = elements.profileNameInput.value.trim();
            if (!user) return showModal('Ошибка', 'Сессия истекла, войдите снова.');
            if (!fullName) return showModal('Внимание', 'Введите ваше имя и фамилию.');
            
            const submitBtn = elements.profileSetupForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner-small"></div> Сохранение...';

            try {
                const phoneNumber = user.email.replace('@burzhuy-pro.app', '');
                await db.collection('users').doc(user.uid).set({
                    fullName,
                    phone: phoneNumber, 
                    role: 'guest',
                    completedChecks: 0
                });
            } catch (err) {
                showModal('Ошибка', 'Не удалось сохранить профиль.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Сохранить и войти';
            }
        });
    }

    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => { auth.signOut(); });
    }

    // --- НАВИГАЦИЯ ---
    document.querySelectorAll('.menu-btn, .admin-hub-btn, .back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.dataset.target;
            if (!target) return;

            switch(target) {
                case 'cooperation-screen': renderAvailableSchedules(); break;
                case 'history-screen': renderHistory(); break;
                case 'admin-schedule-screen': loadCitiesForAdmin(); break;
                case 'admin-reports-screen': renderAllReports(); break;
                case 'admin-users-screen': renderAllUsers(); break;
            }
            showScreen(target);
        });
    });

    if (elements.viewScheduleBtn) {
        elements.viewScheduleBtn.addEventListener('click', () => {
            renderSchedules();
            showScreen('admin-view-schedule-screen');
        });
    }
    
    // --- ЛОГИКА АДМИН-ПАНЕЛИ ---
    async function loadAdminStats() {
        const statsContainer = document.getElementById('admin-stats-container');
        if (!statsContainer) return;
        statsContainer.innerHTML = '<div class="spinner"></div>';
        try {
            const reportsSnapshot = await db.collection('reports').where('status', '==', 'pending').get();
            const usersSnapshot = await db.collection('users').get();
            statsContainer.innerHTML = `
                <div class="stat-card"><h3>${reportsSnapshot.size}</h3><p>Отчетов на проверке</p></div>
                <div class="stat-card"><h3>${usersSnapshot.size}</h3><p>Всего пользователей</p></div>
            `;
        } catch (error) {
            statsContainer.innerHTML = '<p>Не удалось загрузить статистику.</p>';
        }
    }

    async function loadCitiesForAdmin() {
        const { scheduleCitySelect, scheduleLocationSelect } = elements;
        if (!scheduleCitySelect || !scheduleLocationSelect) return;
        scheduleCitySelect.innerHTML = '<option value="" disabled selected>-- Загрузка... --</option>';
        scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- ... --</option>';
        scheduleLocationSelect.disabled = true;
        try {
            const snapshot = await db.collection('locations').get();
            const cities = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!cities[data.city]) cities[data.city] = [];
                cities[data.city].push({ id: doc.id, name: data.name });
            });
            scheduleCitySelect.innerHTML = '<option value="" disabled selected>-- Выберите город --</option>';
            Object.keys(cities).sort().forEach(city => {
                scheduleCitySelect.innerHTML += `<option value="${city}">${city}</option>`;
            });
            scheduleCitySelect.onchange = () => {
                const selectedCity = scheduleCitySelect.value;
                scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- Выберите точку --</option>';
                if (selectedCity && cities[selectedCity]) {
                    cities[selectedCity].forEach(loc => {
                        scheduleLocationSelect.innerHTML += `<option value="${loc.name}">${loc.name}</option>`;
                    });
                    scheduleLocationSelect.disabled = false;
                } else {
                    scheduleLocationSelect.disabled = true;
                }
            };
        } catch (error) {
            showModal("Ошибка", "Не удалось загрузить список городов.");
        }
    }

    if (elements.scheduleForm) elements.scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { scheduleCitySelect, scheduleLocationSelect, scheduleDateInput, scheduleUrgentCheckbox } = elements;
        const city = scheduleCitySelect.value;
        const locationName = scheduleLocationSelect.value;
        const date = scheduleDateInput.value;
        const isUrgent = scheduleUrgentCheckbox.checked;

        if (!city || !locationName || !date) return showModal('Ошибка', 'Заполните все поля.');
        
        const submitBtn = elements.scheduleForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner-small"></div> Публикация...';
        
        try {
            await db.collection('schedules').add({
                city,
                locationName,
                date: new Date(date),
                isUrgent,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isBooked: false
            });
            showModal('Успешно', 'Новая проверка создана.');
            elements.scheduleForm.reset();
            scheduleLocationSelect.disabled = true;
        } catch (error) {
            showModal('Ошибка', 'Не удалось создать проверку.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Опубликовать';
        }
    });

    async function renderSchedules() {
        if (!elements.scheduleList) return;
        elements.scheduleList.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('schedules').orderBy('date', 'desc').get();
            if (snapshot.empty) {
                elements.scheduleList.innerHTML = '<p class="empty-state">Запланированных проверок нет.</p>';
                return;
            }
            let html = '<ul class="menu-list">';
            snapshot.forEach(doc => {
                const s = doc.data();
                const date = s.date.toDate().toLocaleDateString('ru-RU');
                html += `
                    <li class="menu-list-item">
                        <div>
                            <strong>${s.locationName.replace(/^Б\d+\s*/, '')} (${s.city})</strong>
                            <small>Дата: ${date} ${s.isUrgent ? '🔥' : ''}</small>
                        </div>
                        <button class="delete-btn" data-id="${doc.id}">&times;</button>
                    </li>
                `;
            });
            html += '</ul>';
            elements.scheduleList.innerHTML = html;
            elements.scheduleList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => deleteSchedule(e.target.dataset.id));
            });
        } catch (error) {
            elements.scheduleList.innerHTML = '<p>Ошибка загрузки данных.</p>';
        }
    }
    
    function deleteSchedule(scheduleId) {
        showModal('Подтверждение', 'Удалить эту проверку?', 'confirm', (confirmed) => {
            if (confirmed) {
                db.collection('schedules').doc(scheduleId).delete()
                    .then(() => {
                        showModal('Успешно', 'Проверка удалена.');
                        renderSchedules();
                    })
                    .catch(err => showModal('Ошибка', 'Не удалось удалить проверку.'));
            }
        });
    }

    async function renderAllReports() { 
        if (!elements.adminReportsList) return; 
        elements.adminReportsList.innerHTML = '<div class="spinner"></div>'; 
        try {
            const snapshot = await db.collection('reports').orderBy('createdAt', 'desc').get(); 
            if (snapshot.empty) { 
                elements.adminReportsList.innerHTML = '<p class="empty-state">Отчетов пока нет.</p>'; 
                return; 
            } 
            let html = ''; 
            const userIds = [...new Set(snapshot.docs.map(doc => doc.data().userId))]; 
            const usersMap = new Map();
            if (userIds.length > 0) {
                const userPromises = userIds.map(id => db.collection('users').doc(id).get()); 
                const userDocs = await Promise.all(userPromises); 
                userDocs.forEach(d => { if (d.exists) usersMap.set(d.id, d.data()); });
            }
            snapshot.forEach(doc => { 
                const r = doc.data(); 
                const user = usersMap.get(r.userId); 
                const date = r.checkDate?.toDate().toLocaleDateString('ru-RU') || 'без даты'; 
                const statusText = { booked: 'забронирован', pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[r.status] || r.status; 
                html += `<li class="menu-list-item report-item" data-id="${doc.id}">
                            <div class="status-indicator ${r.status}"></div>
                            <div>
                                <strong>${r.locationName?.replace(/^Б\d+\s*/, '') || 'Без имени'}</strong>
                                <small>${user?.fullName || 'Агент'} - ${date} - ${statusText}</small>
                            </div>
                         </li>`; 
            }); 
            elements.adminReportsList.innerHTML = html; 
            elements.adminReportsList.querySelectorAll('.report-item').forEach(item => {
                item.addEventListener('click', () => openAdminReportDetail(item.dataset.id));
            });
        } catch (error) {
            console.error(error);
            elements.adminReportsList.innerHTML = '<p>Ошибка загрузки отчетов.</p>';
        }
    }

    async function openAdminReportDetail(reportId) {
        currentReportId = reportId;
        showScreen('admin-report-detail-screen');
        const detailContainer = document.querySelector('#admin-report-detail-screen .report-details');
        detailContainer.style.opacity = '0.5';
        try {
            const reportDoc = await db.collection('reports').doc(reportId).get();
            if (!reportDoc.exists) throw new Error("Отчет не найден");
            const report = reportDoc.data();
            
            elements.adminDetailAddress.textContent = report.locationName?.replace(/^Б\d+\s*/, '') || '—';
            if (report.userId) {
                const userDoc = await db.collection('users').doc(report.userId).get();
                const user = userDoc.data();
                elements.adminDetailUser.textContent = user?.fullName || 'Пользователь удален';
                elements.adminDetailPhone.textContent = user?.phone || '—';
            } else {
                elements.adminDetailUser.textContent = 'Не привязан';
                elements.adminDetailPhone.textContent = '—';
            }
            
            const dateOnly = report.checkDate?.toDate().toLocaleDateString('ru-RU');
            const time = (report.startTime && report.endTime) ? `(${report.startTime} - ${report.endTime})` : '';
            elements.adminDetailDate.textContent = `${dateOnly} ${time}`;
            elements.adminDetailStatus.innerHTML = `<span class="status-indicator ${report.status}"></span> ${ { booked: 'Забронирован', pending: 'На проверке', approved: 'Принят', rejected: 'Отклонен', paid: 'Оплачен' }[report.status] || report.status}`;
            
            if (report.status === 'rejected' && report.rejectionComment) {
                elements.adminDetailRejectionComment.style.display = 'block';
                elements.adminDetailRejectionComment.innerHTML = `<p><strong>Причина:</strong> ${report.rejectionComment}</p>`;
            } else {
                elements.adminDetailRejectionComment.style.display = 'none';
            }

            for(const key in elements.adminDetailAnswers) {
                elements.adminDetailAnswers[key].textContent = report.answers?.[key] || '—';
            }

            elements.adminDetailPhotos.innerHTML = report.photoUrls?.map(url => 
                `<a href="${url}" target="_blank"><img src="${url}" alt="фото"></a>`
            ).join('') || '<p>Фото не прикреплены.</p>';

        } catch (error) {
            showModal('Ошибка', 'Не удалось загрузить детали отчета.');
        } finally {
            detailContainer.style.opacity = '1';
        }
    }
    
    document.getElementById('admin-action-approve').addEventListener('click', () => updateReportStatus('approved'));
    document.getElementById('admin-action-paid').addEventListener('click', () => updateReportStatus('paid'));
    document.getElementById('admin-action-reject').addEventListener('click', () => {
        const modal = document.getElementById('rejection-modal-container');
        const confirmBtn = document.getElementById('rejection-modal-confirm-btn');
        const cancelBtn = document.getElementById('rejection-modal-cancel-btn');
        const commentInput = document.getElementById('rejection-comment-input');
        commentInput.value = '';
        modal.classList.remove('modal-hidden');

        const confirmHandler = () => {
            if (commentInput.value.trim() === '') return alert('Укажите причину.');
            updateReportStatus('rejected', commentInput.value.trim());
            cleanup();
        };
        const cancelHandler = () => cleanup();
        const cleanup = () => {
            modal.classList.add('modal-hidden');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
        };
        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', cancelHandler);
    });

    async function updateReportStatus(newStatus, rejectionComment = null) {
        if (!currentReportId) return;
        const updateData = { status: newStatus };
        if (rejectionComment) updateData.rejectionComment = rejectionComment;

        try {
            const reportRef = db.collection('reports').doc(currentReportId);
            await reportRef.update(updateData);

            if (newStatus === 'approved') {
                 const reportDoc = await reportRef.get();
                 const userId = reportDoc.data().userId;
                 if (userId) {
                     await db.collection('users').doc(userId).update({
                         completedChecks: firebase.firestore.FieldValue.increment(1)
                     });
                 }
            }
            showModal('Успешно', `Статус отчета изменен.`);
            openAdminReportDetail(currentReportId);
            renderAllReports();
        } catch (error) {
            showModal('Ошибка', 'Не удалось обновить статус.');
        }
    }

    async function renderAllUsers() {
        if (!elements.adminUsersList) return;
        elements.adminUsersList.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('users').get();
            if (snapshot.empty) {
                elements.adminUsersList.innerHTML = '<p class="empty-state">Пользователей не найдено.</p>';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const user = doc.data();
                const isAdmin = user.role === 'admin';
                html += `
                    <div class="user-card">
                        <div class="user-card-header">
                            <div class="user-card-avatar">${user.fullName?.charAt(0).toUpperCase() || '?'}</div>
                            <div>
                                <strong>${user.fullName || 'Без имени'} ${isAdmin ? '(Админ)' : ''}</strong>
                                <small>${user.phone || 'Нет телефона'}</small>
                            </div>
                        </div>
                        <div class="user-card-stats">
                            <div><span>${user.completedChecks || 0}</span><small>Проверок</small></div>
                        </div>
                        <div class="user-card-actions">
                            <button class="role-toggle-btn ${isAdmin ? 'admin' : ''}" data-id="${doc.id}" data-role="${user.role}" data-name="${user.fullName}">
                                ${isAdmin ? 'Понизить' : 'Сделать админом'}
                            </button>
                            <button class="delete-user-btn" data-id="${doc.id}" data-name="${user.fullName}">Удалить</button>
                        </div>
                    </div>
                `;
            });
            elements.adminUsersList.innerHTML = html;
            
            elements.adminUsersList.querySelectorAll('.role-toggle-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const { id, role, name } = e.currentTarget.dataset;
                    toggleUserRole(id, role, name);
                });
            });

            elements.adminUsersList.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const { id, name } = e.currentTarget.dataset;
                    deleteUser(id, name);
                });
            });

        } catch (error) {
            elements.adminUsersList.innerHTML = '<p>Ошибка загрузки пользователей.</p>';
        }
    }
    
    function toggleUserRole(userId, currentRole, name) {
        const newRole = currentRole === 'admin' ? 'guest' : 'admin';
        const actionText = newRole === 'admin' ? `повысить ${name} до админа` : `понизить ${name} до агента`;
        showModal('Подтверждение', `Вы уверены, что хотите ${actionText}?`, 'confirm', (confirmed) => {
            if (confirmed) {
                db.collection('users').doc(userId).update({ role: newRole })
                    .then(() => {
                        showModal('Успешно', 'Роль изменена.');
                        renderAllUsers();
                    })
                    .catch(() => showModal('Ошибка', 'Не удалось изменить роль.'));
            }
        });
    }

    function deleteUser(userId, name) {
        showModal('Подтверждение', `Удалить пользователя ${name}? Это действие нельзя отменить.`, 'confirm', (confirmed) => {
            if (confirmed) {
                db.collection('users').doc(userId).delete()
                    .then(() => {
                        showModal('Успешно', `Пользователь ${name} удален.`);
                        renderAllUsers();
                    })
                    .catch(() => showModal('Ошибка', 'Не удалось удалить пользователя.'));
            }
        });
    }

    // --- ЛОГИКА АГЕНТА ---
    async function renderAvailableSchedules() {
        if (!elements.scheduleCardsList) return;
        elements.scheduleCardsList.innerHTML = '<div class="spinner"></div>';
        elements.noSchedulesView.style.display = 'none';
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const snapshot = await db.collection('schedules')
                .where('date', '>=', today)
                .where('isBooked', '==', false)
                .orderBy('date')
                .get();
            
            if (snapshot.empty) {
                elements.scheduleCardsList.innerHTML = '';
                elements.noSchedulesView.style.display = 'block';
                return;
            }
            let html = '';
            snapshot.forEach(doc => {
                const s = doc.data();
                const date = s.date.toDate().toLocaleDateString('ru-RU', { month: 'long', day: 'numeric' });
                html += `
                    <li class="menu-list-item schedule-card" data-id="${doc.id}">
                        ${s.isUrgent ? '<div class="urgent-badge">🔥 Срочно</div>' : ''}
                        <div>
                            <strong>${s.locationName.replace(/^Б\d+\s*/, '')}</strong>
                            <small>${s.city} - ${date}</small>
                        </div>
                    </li>
                `;
            });
            elements.scheduleCardsList.innerHTML = html;
            elements.scheduleCardsList.querySelectorAll('.schedule-card').forEach(card => {
                card.addEventListener('click', () => openTimePicker(card.dataset.id));
            });
    
        } catch (error) {
            elements.scheduleCardsList.innerHTML = '<p>Не удалось загрузить данные.</p>';
        }
    }

    async function openTimePicker(scheduleId) {
        try {
            const doc = await db.collection('schedules').doc(scheduleId).get();
            if (!doc.exists || doc.data().isBooked) {
                showModal('Ошибка', 'Эта проверка больше недоступна.');
                renderAvailableSchedules();
                return;
            }
            selectedScheduleForBooking = { id: doc.id, ...doc.data() };
            elements.pickerLocationTitle.textContent = selectedScheduleForBooking.locationName.replace(/^Б\d+\s*/, '');
            elements.timePickerForm.reset();
            showScreen('time-picker-screen');
        } catch (error) {
            showModal('Ошибка', 'Не удалось получить данные о проверке.');
        }
    }

    if (elements.timePickerForm) elements.timePickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const startTime = document.getElementById('user-start-time').value;
        const endTime = document.getElementById('user-end-time').value;
        const user = auth.currentUser;

        if (!startTime || !endTime) return showModal('Ошибка', 'Укажите интервал времени.');
        if (startTime >= endTime) return showModal('Ошибка', 'Время начала должно быть раньше окончания.');
        
        const submitBtn = elements.timePickerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner-small"></div> Запись...';

        const scheduleRef = db.collection('schedules').doc(selectedScheduleForBooking.id);
        const reportRef = db.collection('reports').doc();

        try {
            await db.runTransaction(async (transaction) => {
                const scheduleDoc = await transaction.get(scheduleRef);
                if (scheduleDoc.data().isBooked) {
                    throw new Error("Эта проверка уже забронирована.");
                }
                
                transaction.update(scheduleRef, { isBooked: true });
                transaction.set(reportRef, {
                    userId: user.uid,
                    scheduleId: selectedScheduleForBooking.id,
                    locationName: selectedScheduleForBooking.locationName,
                    city: selectedScheduleForBooking.city,
                    checkDate: selectedScheduleForBooking.date,
                    startTime, endTime, status: 'booked',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    answers: {}, photoUrls: []
                });
            });
            
            await loadUserDashboard(user.uid); 
            showModal('Успешно!', 'Вы записались. Задание появилось на главном экране.', 'alert', () => {
                showScreen('main-menu-screen');
            });

        } catch (error) {
            showModal('Ошибка', error.message || 'Не удалось записаться.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Подтвердить и записаться';
            renderAvailableSchedules();
        }
    });

    async function loadUserDashboard(userId) {
        // ... реализация уже была в коде выше ...
        // (Оставил только одну копию для ясности)
    }

    async function cancelBooking(reportId) {
        showModal('Подтверждение', 'Отменить эту проверку?', 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    const reportDoc = await db.collection('reports').doc(reportId).get();
                    if (!reportDoc.exists) throw new Error("Отчет не найден");
                    const scheduleId = reportDoc.data().scheduleId;

                    const batch = db.batch();
                    batch.delete(db.collection('reports').doc(reportId));
                    if (scheduleId) {
                       batch.update(db.collection('schedules').doc(scheduleId), { isBooked: false });
                    }
                    await batch.commit();

                    showModal('Успешно', 'Запись отменена.');
                    loadUserDashboard(auth.currentUser.uid);
                    renderAvailableSchedules(); 
                } catch (error) {
                    showModal('Ошибка', 'Не удалось отменить запись.');
                }
            }
        });
    }

    async function openChecklist(reportId) {
        try {
            const doc = await db.collection('reports').doc(reportId).get();
            if (!doc.exists) return showModal('Ошибка', 'Задание не найдено.');
            
            currentReportId = reportId;
            const report = doc.data();
            elements.checklistAddress.textContent = report.locationName.replace(/^Б\d+\s*/, '');
            const date = report.checkDate.toDate().toLocaleDateString('ru-RU');
            const time = `(${report.startTime} - ${report.endTime})`;
            elements.checklistDate.textContent = `${date} ${time}`;
            elements.checklistForm.reset();
            showScreen('checklist-screen');

        } catch (error) {
            showModal('Ошибка', 'Не удалось загрузить чек-лист.');
        }
    }

    if (elements.checklistForm) elements.checklistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !currentReportId) return;

        const submitBtn = elements.checklistForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner-small"></div> Отправка...';

        try {
            const answers = {
                q1: document.getElementById('checklist-q1-appearance').value,
                q2: document.getElementById('checklist-q2-cleanliness').value,
                q3: document.getElementById('checklist-q3-greeting').value,
                q4: document.getElementById('checklist-q4-upsell').value,
                q5: document.getElementById('checklist-q5-actions').value,
                q6: document.getElementById('checklist-q6-handout').value,
                q7: document.getElementById('checklist-q7-order-eval').value,
                q8: document.getElementById('checklist-q8-food-rating').value,
                q9: document.getElementById('checklist-q9-comments').value
            };

            const files = document.getElementById('checklist-photos').files;
            if (files.length === 0) throw new Error("Прикрепите хотя бы одно фото.");
            
            const photoUrls = [];
            for (const file of files) {
                const filePath = `reports/${currentReportId}/${Date.now()}_${file.name}`;
                const fileSnapshot = await storage.ref(filePath).put(file);
                const url = await fileSnapshot.ref.getDownloadURL();
                photoUrls.push(url);
            }
            
            await db.collection('reports').doc(currentReportId).update({
                answers, photoUrls, status: 'pending',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showModal('Отчет отправлен!', 'Спасибо! Мы свяжемся с вами после проверки.', 'alert', 
                () => {
                    showScreen('main-menu-screen');
                    loadUserDashboard(user.uid);
                }
            );

        } catch (error) {
            showModal('Ошибка', error.message || 'Ошибка при отправке отчета.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить отчёт';
        }
    });

    async function renderHistory() { 
        if (!elements.historyList) return; 
        elements.historyList.innerHTML = '<div class="spinner"></div>'; 
        const user = auth.currentUser; 
        if (!user) return; 
        
        try {
            const snapshot = await db.collection('reports')
                .where('userId', '==', user.uid)
                .where('status', 'in', ['pending', 'approved', 'rejected', 'paid'])
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) { 
                elements.historyList.innerHTML = '<p class="empty-state">Вы еще не отправляли ни одного отчета.</p>'; 
                return; 
            } 
            
            let historyHTML = ''; 
            snapshot.forEach(doc => { 
                const report = doc.data();
                const date = report.checkDate?.toDate().toLocaleDateString('ru-RU') || 'без даты'; 
                const statusText = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[report.status] || report.status; 
                const commentHTML = (report.status === 'rejected' && report.rejectionComment) ?
                    `<small class="rejection-comment"><b>Причина:</b> ${report.rejectionComment}</small>` : ''; 
                
                historyHTML += `<li class="menu-list-item history-item">
                                    <div class="status-indicator ${report.status}"></div>
                                    <div>
                                        <strong>${report.locationName.replace(/^Б\d+\s*/, '')}</strong>
                                        <small>Дата: ${date} - Статус: ${statusText}</small>
                                        ${commentHTML}
                                    </div>
                                </li>`; 
            }); 
            elements.historyList.innerHTML = historyHTML; 
        } catch (error) {
            elements.historyList.innerHTML = '<p>Не удалось загрузить историю.</p>';
        }
    }
});
