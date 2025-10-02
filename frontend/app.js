// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.firebasestorage.app", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
// let confirmationResult = null; // <-- УДАЛЕНО
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
    const loginRegisterForm = document.getElementById('login-register-form'); // <-- ИЗМЕНЕНО
    const profileSetupForm = document.getElementById('profile-setup-form');
    const phoneInput = document.getElementById('phone-input');
    const passwordInput = document.getElementById('password-input'); // <-- ДОБАВЛЕНО
    const profileNameInput = document.getElementById('profile-name-input');
    const loginRegisterBtn = document.getElementById('login-register-btn'); // <-- ИЗМЕНЕНО
    const userNameDisplay = document.getElementById('user-name-display');
    const logoutBtn = document.getElementById('logout-btn');
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
    
    // Вся логика reCAPTCHA и СМС удалена
    if (phoneInput) { phoneInput.addEventListener('input', () => { if (!phoneInput.value.startsWith('+7')) { phoneInput.value = '+7'; } }); }

    // --- АУТЕНТИФИКАЦИЯ (ПОЛНОСТЬЮ ПЕРЕПИСАНА) ---
    if(loginRegisterForm) {
        loginRegisterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 1. Валидация и форматирование номера
            let rawPhoneNumber = phoneInput.value;
            let digitsOnly = rawPhoneNumber.replace(/\D/g, '');
            if (digitsOnly.startsWith('8')) digitsOnly = '7' + digitsOnly.substring(1);
            if (digitsOnly.length < 11) return showModal('Ошибка', 'Пожалуйста, введите полный номер телефона.');
            const formattedPhoneNumber = `+${digitsOnly}`;

            const password = passwordInput.value;
            if (password.length < 6) return showModal('Ошибка', 'Пароль должен содержать не менее 6 символов.');

            // Используем номер телефона как часть email для совместимости с Firebase
            const email = `${formattedPhoneNumber}@burzhuy-pro.app`;

            loginRegisterBtn.disabled = true;
            loginRegisterBtn.textContent = 'Обработка...';

            // 2. Пытаемся создать нового пользователя
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    // Успешная регистрация, onAuthStateChanged перенаправит на создание профиля
                    console.log('Новый пользователь зарегистрирован.');
                })
                .catch(error => {
                    // 3. Если пользователь уже существует, пытаемся войти
                    if (error.code === 'auth/email-already-in-use') {
                        auth.signInWithEmailAndPassword(email, password)
                            .then(userCredential => {
                                // Успешный вход
                                console.log('Пользователь успешно вошел.');
                            })
                            .catch(signInError => {
                                // Ошибка входа (например, неверный пароль)
                                showModal('Ошибка входа', 'Неверный номер телефона или пароль.');
                            });
                    } else if (error.code === 'auth/weak-password') {
                         showModal('Ошибка регистрации', 'Пароль слишком простой. Используйте не менее 6 символов.');
                    } else {
                        // Другие ошибки
                        showModal('Ошибка', `Произошла ошибка: ${error.message}`);
                    }
                })
                .finally(() => {
                    loginRegisterBtn.disabled = false;
                    loginRegisterBtn.textContent = 'Войти / Создать аккаунт';
                });
        });
    }

    if(profileSetupForm) {
        profileSetupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const fullName = profileNameInput.value.trim();
            if (!user || !fullName) return;

            // Извлекаем номер телефона из "email" пользователя
            const phoneNumber = user.email.replace('@burzhuy-pro.app', '');

            db.collection('users').doc(user.uid).set({
                fullName,
                phone: phoneNumber, // <-- ИЗМЕНЕНО
                role: 'guest',
                completedChecks: 0
            }).then(() => {
                userNameDisplay.textContent = fullName;
                showScreen('main-menu-screen');
            }).catch(err => showModal('Ошибка', 'Не удалось сохранить профиль.'));
        });
    }

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР ---
    auth.onAuthStateChanged(user => {
        document.getElementById('loader').classList.remove('active');
        if (user) {
            db.collection('users').doc(user.uid).onSnapshot(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const userAvatar = document.querySelector('.dashboard-header .avatar');
                    userNameDisplay.textContent = userData.fullName;
                    if(userAvatar) userAvatar.textContent = userData.fullName.charAt(0).toUpperCase();
                    if (adminMenuBtn) adminMenuBtn.style.display = (userData.role === 'admin') ? 'flex' : 'none';
                    if (userData.role === 'admin') loadAdminStats();
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    // Если пользователь есть в Auth, но нет профиля в DB -> на страницу создания
                    showScreen('profile-setup-screen');
                }
            }, err => {
                console.error("Ошибка получения профиля:", err);
                showModal('Критическая ошибка', 'Не удалось загрузить данные профиля. Пожалуйста, обновите страницу.');
            });
        } else {
            // Если пользователя нет, показываем экран входа/регистрации
            if (adminMenuBtn) adminMenuBtn.style.display = 'none';
            showScreen('auth-screen');
        }
    });
    
    if(logoutBtn) logoutBtn.addEventListener('click', () => { auth.signOut(); });

    // --- ЛОГИКА АДМИН-ПАНЕЛИ (без изменений) ---
    if (adminMenuBtn) adminMenuBtn.addEventListener('click', () => showScreen('admin-hub-screen'));
    
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
            console.error("Ошибка загрузки статистики:", error);
            statsContainer.innerHTML = '<p>Не удалось загрузить статистику.</p>';
        }
    }

    async function loadCitiesForAdmin() {
        const locationsRef = db.collection('locations');
        scheduleCitySelect.innerHTML = '<option value="" disabled selected>-- Загрузка... --</option>';
        scheduleLocationSelect.innerHTML = '<option value="" disabled selected>-- ... --</option>';
        scheduleLocationSelect.disabled = true;
        try {
            const snapshot = await locationsRef.get();
            const cities = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!cities[data.city]) cities[data.city] = [];
                cities[data.city].push({ id: doc.id, name: data.name });
            });
            scheduleCitySelect.innerHTML = '<option value="" disabled selected>-- Выберите город --</option>';
            for (const city in cities) {
                scheduleCitySelect.innerHTML += `<option value="${city}">${city}</option>`;
            }
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
            console.error("Ошибка загрузки городов:", error);
            showModal("Ошибка", "Не удалось загрузить список городов. Убедитесь, что в Firestore есть коллекция 'locations'.");
        }
    }

    if (scheduleForm) scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const city = scheduleCitySelect.value;
        const locationName = scheduleLocationSelect.value;
        const date = scheduleDateInput.value;
        const startTime = scheduleStartTimeInput.value;
        const endTime = scheduleEndTimeInput.value;
        const isUrgent = scheduleUrgentCheckbox.checked;

        if (!city || !locationName || !date || !startTime || !endTime) {
            return showModal('Ошибка', 'Пожалуйста, заполните все поля.');
        }

        const submitBtn = scheduleForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Публикация...';
        
        try {
            await db.collection('schedules').add({
                city,
                locationName,
                date: new Date(date),
                startTime,
                endTime,
                isUrgent,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isBooked: false
            });
            showModal('Успешно', 'Новая проверка успешно создана и опубликована.');
            scheduleForm.reset();
            scheduleLocationSelect.disabled = true;
        } catch (error) {
            console.error("Ошибка создания проверки:", error);
            showModal('Ошибка', 'Не удалось создать проверку. Попробуйте снова.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Опубликовать';
        }
    });

    async function renderSchedules() {
        if (!scheduleList) return;
        scheduleList.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('schedules').orderBy('date', 'desc').get();
            if (snapshot.empty) {
                scheduleList.innerHTML = '<p>Запланированных проверок нет.</p>';
                return;
            }
            let html = '<ul class="menu-list">';
            snapshot.forEach(doc => {
                const s = doc.data();
                const date = s.date.toDate().toLocaleDateString('ru-RU');
                html += `
                    <li class="menu-list-item">
                        <div>
                            <strong>${s.locationName} (${s.city})</strong>
                            <small>Дата: ${date} | Доступно: ${s.startTime} - ${s.endTime} ${s.isUrgent ? '🔥' : ''}</small>
                        </div>
                        <button class="delete-btn" data-id="${doc.id}">&times;</button>
                    </li>
                `;
            });
            html += '</ul>';
            scheduleList.innerHTML = html;
            scheduleList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => deleteSchedule(e.target.dataset.id));
            });
        } catch (error) {
            console.error("Ошибка отображения проверок:", error);
            scheduleList.innerHTML = '<p>Ошибка загрузки данных.</p>';
        }
    }
    
    function deleteSchedule(scheduleId) {
        showModal('Подтверждение', 'Вы уверены, что хотите удалить эту проверку? Это действие необратимо.', 'confirm', (confirmed) => {
            if (confirmed) {
                db.collection('schedules').doc(scheduleId).delete()
                    .then(() => {
                        showModal('Успешно', 'Проверка удалена.');
                        renderSchedules();
                    })
                    .catch(err => {
                        console.error("Ошибка удаления:", err);
                        showModal('Ошибка', 'Не удалось удалить проверку.');
                    });
            }
        });
    }

    async function renderAllReports() { 
        if (!adminReportsList) return; 
        adminReportsList.innerHTML = '<div class="spinner"></div>'; 
        const snapshot = await db.collection('reports').orderBy('createdAt', 'desc').get(); 
        if (snapshot.empty) { 
            adminReportsList.innerHTML = '<p>Отчетов пока нет.</p>'; 
            return; 
        } 
        let html = ''; 
        const userIds = [...new Set(snapshot.docs.map(doc => doc.data().userId))]; 
        if (userIds.length > 0) { 
            const userPromises = userIds.map(id => db.collection('users').doc(id).get()); 
            const userDocs = await Promise.all(userPromises); 
            const usersMap = new Map(userDocs.map(d => [d.id, d.data()])); 
            snapshot.forEach(doc => { 
                const r = doc.data(); 
                const user = usersMap.get(r.userId); 
                const date = r.checkDate && r.checkDate.toDate ? r.checkDate.toDate().toLocaleDateString('ru-RU') : 'без даты'; 
                const statusText = { booked: 'забронирован', pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[r.status] || r.status; 
                html += `<li class="menu-list-item report-item" data-id="${doc.id}">
                            <div class="status-indicator ${r.status}"></div>
                            <div>
                                <strong>${r.locationName.replace(/^Б\d+\s*/, '')}</strong>
                                <small>${user?.fullName || 'Агент'} - ${date} - ${statusText}</small>
                            </div>
                            <button class="delete-report-btn" data-id="${doc.id}">Удалить</button>
                         </li>`; 
            }); 
        } 
        adminReportsList.innerHTML = html; 
        adminReportsList.querySelectorAll('.report-item').forEach(item => item.addEventListener('click', (e) => { 
            if (e.target.classList.contains('delete-report-btn')) return; 
            openAdminReportDetail(item.dataset.id); 
        }));
        adminReportsList.querySelectorAll('.delete-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteReport(e.target.dataset.id);
            });
        });
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
            
            const userDoc = await db.collection('users').doc(report.userId).get();
            const user = userDoc.exists ? userDoc.data() : { fullName: 'Неизвестно', phone: 'Неизвестно' };

            adminDetailAddress.textContent = report.locationName;
            adminDetailUser.textContent = user.fullName;
            adminDetailPhone.textContent = user.phone;
            adminDetailDate.textContent = report.checkDate.toDate().toLocaleString('ru-RU');
            adminDetailStatus.innerHTML = `<span class="status-indicator ${report.status}" style="margin-right: 8px;"></span> ${ { booked: 'Забронирован', pending: 'На проверке', approved: 'Принят', rejected: 'Отклонен', paid: 'Оплачен' }[report.status] || report.status}`;

            if(report.status === 'rejected' && report.rejectionComment) {
                adminDetailRejectionComment.style.display = 'block';
                adminDetailRejectionComment.innerHTML = `<p><strong>Причина отклонения:</strong> ${report.rejectionComment}</p>`;
            } else {
                adminDetailRejectionComment.style.display = 'none';
            }

            const answers = report.answers || {};
            for(const key in adminDetailAnswers) {
                if(adminDetailAnswers[key]) {
                    adminDetailAnswers[key].textContent = answers[key] || '—';
                }
            }

            adminDetailPhotos.innerHTML = '';
            if (report.photoUrls && report.photoUrls.length > 0) {
                report.photoUrls.forEach(url => {
                    adminDetailPhotos.innerHTML += `<a href="${url}" target="_blank"><img src="${url}" alt="фотоотчет" style="width: 100px; height: 100px; object-fit: cover; margin: 5px; border-radius: 8px;"></a>`;
                });
            } else {
                adminDetailPhotos.innerHTML = '<p>Фотографии не были прикреплены.</p>';
            }
        } catch (error) {
            console.error("Ошибка загрузки деталей отчета:", error);
            showModal('Ошибка', 'Не удалось загрузить детали отчета.');
        } finally {
            detailContainer.style.opacity = '1';
        }
    }

    function deleteReport(reportId) {
        showModal('Подтверждение', 'Вы уверены, что хотите БЕЗВОЗВРАТНО удалить этот отчет? Это действие нельзя отменить.', 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    await db.collection('reports').doc(reportId).delete();
                    showModal('Успешно', 'Отчет был удален.');
                    renderAllReports();
                } catch (error) {
                    console.error("Ошибка удаления отчета:", error);
                    showModal('Ошибка', 'Не удалось удалить отчет.');
                }
            }
        });
    }
    
    document.getElementById('admin-action-approve').addEventListener('click', () => updateReportStatus('approved'));
    document.getElementById('admin-action-reject').addEventListener('click', () => {
        const modal = document.getElementById('rejection-modal-container');
        const confirmBtn = document.getElementById('rejection-modal-confirm-btn');
        const cancelBtn = document.getElementById('rejection-modal-cancel-btn');
        const commentInput = document.getElementById('rejection-comment-input');
        commentInput.value = '';
        modal.classList.remove('modal-hidden');

        const confirmHandler = () => {
            if (commentInput.value.trim() === '') {
                alert('Пожалуйста, укажите причину отклонения.');
                return;
            }
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
    document.getElementById('admin-action-paid').addEventListener('click', () => updateReportStatus('paid'));

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
                 const userRef = db.collection('users').doc(userId);
                 await userRef.update({
                     completedChecks: firebase.firestore.FieldValue.increment(1)
                 });
            }

            showModal('Успешно', `Статус отчета изменен на "${newStatus}".`);
            openAdminReportDetail(currentReportId);
            renderAllReports();
        } catch (error) {
            console.error("Ошибка обновления статуса:", error);
            showModal('Ошибка', 'Не удалось обновить статус отчета.');
        }
    }

    async function renderAllUsers() {
        if (!adminUsersList) return;
        adminUsersList.innerHTML = '<div class="spinner"></div>';
        try {
            const usersSnapshot = await db.collection('users').get();
            if (usersSnapshot.empty) {
                adminUsersList.innerHTML = '<p>Пользователей не найдено.</p>';
                return;
            }
            let html = '';
            usersSnapshot.forEach(doc => {
                const user = doc.data();
                const isAdmin = user.role === 'admin';
                html += `
                    <div class="user-card">
                        <div class="user-card-header">
                            <div class="user-card-avatar">${user.fullName.charAt(0).toUpperCase()}</div>
                            <div class="user-card-info">
                                <strong>${user.fullName} ${isAdmin ? '(Админ)' : ''}</strong>
                                <small>${user.phone}</small>
                            </div>
                        </div>
                        <div class="user-card-stats">
                            <div>
                                <span>${user.completedChecks || 0}</span>
                                <small>Проверок</small>
                            </div>
                        </div>
                        <div class="user-card-actions">
                            <button class="role-toggle-btn ${isAdmin ? 'admin' : ''}" data-id="${doc.id}" data-role="${user.role}" data-name="${user.fullName}">
                                ${isAdmin ? 'Понизить до агента' : 'Повысить до админа'}
                            </button>
                            <button class="delete-user-btn" data-id="${doc.id}" data-name="${user.fullName}">Удалить</button>
                        </div>
                    </div>
                `;
            });
            adminUsersList.innerHTML = html;
            
            adminUsersList.querySelectorAll('.role-toggle-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const { id, role, name } = e.currentTarget.dataset;
                    toggleUserRole(id, role, name);
                });
            });

            adminUsersList.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const { id, name } = e.currentTarget.dataset;
                    deleteUser(id, name);
                });
            });

        } catch (error) {
            console.error("Ошибка отображения пользователей:", error);
            adminUsersList.innerHTML = '<p>Ошибка загрузки данных.</p>';
        }
    }
    
    function toggleUserRole(userId, currentRole, name) {
        const newRole = currentRole === 'admin' ? 'guest' : 'admin';
        const actionText = newRole === 'admin' ? `повысить пользователя ${name} до администратора` : `понизить администратора ${name} до обычного пользователя`;
        showModal('Подтверждение', `Вы уверены, что хотите ${actionText}?`, 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    await db.collection('users').doc(userId).update({ role: newRole });
                    showModal('Успешно', 'Роль пользователя изменена.');
                    renderAllUsers();
                } catch (error) {
                    showModal('Ошибка', 'Не удалось изменить роль.');
                    console.error("Ошибка смены роли:", error);
                }
            }
        });
    }

    function deleteUser(userId, name) {
        showModal('Подтверждение', `Вы уверены, что хотите удалить пользователя ${name}? Пользователь больше не сможет войти в систему.`, 'confirm', async (confirmed) => {
            if (confirmed) {
                 showModal('Критическое подтверждение', `ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ: Удалить ${name} безвозвратно?`, 'confirm', async (finalConfirmation) => {
                    if(finalConfirmation) {
                        try {
                            await db.collection('users').doc(userId).delete();
                            showModal('Успешно', `Пользователь ${name} удален из базы данных.`);
                            renderAllUsers();
                        } catch (error) {
                            showModal('Ошибка', 'Не удалось удалить пользователя.');
                            console.error("Ошибка удаления:", error);
                        }
                    }
                 });
            }
        });
    }

    // --- ЛОГИКА АГЕНТА (без изменений) ---
    async function renderAvailableSchedules() {
        if (!scheduleCardsList) return;
        scheduleCardsList.innerHTML = '<div class="spinner"></div>';
        noSchedulesView.style.display = 'none';
    
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
    
            const snapshot = await db.collection('schedules')
                .where('date', '>=', today)
                .orderBy('date')
                .get();
    
            let availableSchedules = [];
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const schedule = { id: doc.id, ...doc.data() };
                    if (!schedule.isBooked) {
                        availableSchedules.push(schedule);
                    }
                });
            }
    
            if (availableSchedules.length === 0) {
                scheduleCardsList.innerHTML = '';
                noSchedulesView.style.display = 'block';
                return;
            }
    
            let html = '';
            availableSchedules.forEach(s => {
                const date = s.date.toDate().toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
                html += `
                    <li class="menu-list-item schedule-card" data-id="${s.id}">
                        ${s.isUrgent ? '<div class="urgent-badge">🔥 Срочно</div>' : ''}
                        <div>
                            <strong>${s.locationName}</strong>
                            <small>${s.city} - ${date} | Доступно: ${s.startTime} - ${s.endTime}</small>
                        </div>
                    </li>
                `;
            });
            scheduleCardsList.innerHTML = html;
    
            scheduleCardsList.querySelectorAll('.schedule-card').forEach(card => {
                card.addEventListener('click', () => openTimePicker(card.dataset.id));
            });
    
        } catch (error) {
            console.error("Ошибка загрузки доступных проверок:", error);
            scheduleCardsList.innerHTML = '<p>Не удалось загрузить данные.</p>';
        }
    }

    async function openTimePicker(scheduleId) {
        try {
            const doc = await db.collection('schedules').doc(scheduleId).get();
            if (!doc.exists) {
                showModal('Ошибка', 'Эта проверка больше недоступна.');
                renderAvailableSchedules();
                return;
            }
            selectedScheduleForBooking = { id: doc.id, ...doc.data() };
            pickerLocationTitle.textContent = selectedScheduleForBooking.locationName;
            
            userChosenTimeInput.min = selectedScheduleForBooking.startTime;
            userChosenTimeInput.max = selectedScheduleForBooking.endTime;
            userChosenTimeInput.value = selectedScheduleForBooking.startTime;

            showScreen('time-picker-screen');
        } catch (error) {
            console.error("Ошибка:", error);
            showModal('Ошибка', 'Не удалось получить данные о проверке.');
        }
    }

    if (timePickerForm) timePickerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const chosenTime = userChosenTimeInput.value;
        const user = auth.currentUser;
        if (!chosenTime || !selectedScheduleForBooking || !user) {
            return showModal('Ошибка', 'Произошла непредвиденная ошибка. Попробуйте снова.');
        }
        
        const submitBtn = timePickerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Запись...';

        const scheduleRef = db.collection('schedules').doc(selectedScheduleForBooking.id);
        const reportRef = db.collection('reports').doc();

        try {
            await db.runTransaction(async (transaction) => {
                const scheduleDoc = await transaction.get(scheduleRef);
                if (scheduleDoc.data().isBooked) {
                    throw new Error("Эта проверка уже была забронирована другим агентом.");
                }
                
                transaction.update(scheduleRef, { isBooked: true });
            
                const checkDateTime = new Date(selectedScheduleForBooking.date.toDate());
                const [hours, minutes] = chosenTime.split(':');
                checkDateTime.setHours(hours, minutes);

                transaction.set(reportRef, {
                    userId: user.uid,
                    scheduleId: selectedScheduleForBooking.id,
                    locationName: selectedScheduleForBooking.locationName,
                    city: selectedScheduleForBooking.city,
                    checkDate: firebase.firestore.Timestamp.fromDate(checkDateTime),
                    status: 'booked',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    answers: {},
                    photoUrls: []
                });
            });
            
            showModal('Успешно!', 'Вы записались на проверку. Задание появилось на вашем главном экране.', 'alert', () => {
                showScreen('main-menu-screen');
            });

        } catch (error) {
            console.error("Ошибка записи:", error);
            showModal('Ошибка', error.message || 'Не удалось записаться на проверку. Возможно, она уже занята. Обновите список.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Подтвердить и записаться';
            renderAvailableSchedules();
        }
    });

    async function loadUserDashboard(userId) {
        if (!dashboardInfoContainer) return;
        dashboardInfoContainer.innerHTML = '';
        try {
            const snapshot = await db.collection('reports')
                .where('userId', '==', userId)
                .get();

            let activeTasks = [];
            snapshot.forEach(doc => {
                const report = { id: doc.id, ...doc.data() };
                if (report.status === 'booked') {
                    activeTasks.push(report);
                }
            });

            activeTasks.sort((a, b) => a.checkDate.toDate() - b.checkDate.toDate());

            if (activeTasks.length === 0) {
                dashboardInfoContainer.innerHTML = '<div class="empty-state"><p>У вас нет активных заданий. Время выбрать новое!</p></div>';
                return;
            }

            let html = '<h3>Ваши активные задания:</h3><ul class="menu-list">';
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            activeTasks.forEach(report => {
                const checkDate = report.checkDate.toDate();
                const isCheckDayOrPast = checkDate.getTime() < (today.getTime() + (24 * 60 * 60 * 1000)); // True если сегодня или раньше
                
                const dateString = checkDate.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'});
                html += `
                    <li class="menu-list-item active-task-card">
                        <div>
                            <strong>${report.locationName}</strong>
                            <small>Запланировано на: ${dateString}</small>
                            <div class="task-actions">
                                <button class="btn-fill-checklist" data-id="${report.id}" ${!isCheckDayOrPast ? 'disabled' : ''}>Заполнить чек-лист</button>
                                <button class="btn-cancel-booking" data-id="${report.id}">Отменить</button>
                            </div>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            dashboardInfoContainer.innerHTML = html;

            dashboardInfoContainer.querySelectorAll('.btn-fill-checklist').forEach(btn => {
                btn.addEventListener('click', () => openChecklist(btn.dataset.id));
            });

            dashboardInfoContainer.querySelectorAll('.btn-cancel-booking').forEach(btn => {
                btn.addEventListener('click', () => cancelBooking(btn.dataset.id));
            });

        } catch (error) {
            console.error("Ошибка загрузки дашборда:", error);
            dashboardInfoContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Не удалось загрузить ваши задания.</p>';
        }
    }

    async function cancelBooking(reportId) {
        showModal('Подтверждение', 'Вы уверены, что хотите отменить эту проверку? Другой агент сможет на нее записаться.', 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    const reportDoc = await db.collection('reports').doc(reportId).get();
                    if (!reportDoc.exists) throw new Error("Отчет не найден");
                    const scheduleId = reportDoc.data().scheduleId;

                    const batch = db.batch();
                    const reportRef = db.collection('reports').doc(reportId);
                    const scheduleRef = db.collection('schedules').doc(scheduleId);

                    batch.delete(reportRef);
                    batch.update(scheduleRef, { isBooked: false });

                    await batch.commit();
                    showModal('Успешно', 'Запись отменена.');
                    loadUserDashboard(auth.currentUser.uid);
                } catch (error) {
                    console.error("Ошибка отмены:", error);
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
            checklistAddress.textContent = report.locationName;
            checklistDate.textContent = report.checkDate.toDate().toLocaleString('ru-RU');
            checklistForm.reset();
            showScreen('checklist-screen');

        } catch (error) {
            console.error("Ошибка открытия чек-листа:", error);
            showModal('Ошибка', 'Не удалось загрузить данные для чек-листа.');
        }
    }

    if (checklistForm) checklistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !currentReportId) return;

        const submitBtn = checklistForm.querySelector('button[type="submit"]');
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
            if (files.length === 0) {
                 throw new Error("Необходимо прикрепить хотя бы одно фото.");
            }
            const photoUrls = [];

            for (const file of files) {
                const filePath = `reports/${currentReportId}/${Date.now()}_${file.name}`;
                const fileSnapshot = await storage.ref(filePath).put(file);
                const url = await fileSnapshot.ref.getDownloadURL();
                photoUrls.push(url);
            }
            
            await db.collection('reports').doc(currentReportId).update({
                answers,
                photoUrls,
                status: 'pending',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showModal(
                'Отчет отправлен на проверку!', 
                'Спасибо за вашу работу. Если отчет будет принят, мы свяжемся с вами по вашему номеру телефона для возврата средств.', 
                'alert', 
                () => {
                    showScreen('main-menu-screen');
                    loadUserDashboard(user.uid);
                }
            );

        } catch (error) {
            console.error("Ошибка отправки отчета:", error);
            showModal('Ошибка', error.message || 'Произошла ошибка при отправке отчета. Пожалуйста, попробуйте снова.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Отправить отчёт';
        }
    });

    async function renderHistory() { 
        if (!historyList) return; 
        historyList.innerHTML = '<div class="spinner"></div>'; 
        const user = auth.currentUser; 
        if (!user) return; 
        
        try {
            const snapshot = await db.collection('reports')
                .where('userId', '==', user.uid)
                .get();

            let userHistory = [];
            snapshot.forEach(doc => {
                const report = { id: doc.id, ...doc.data() };
                if (['pending', 'approved', 'rejected', 'paid'].includes(report.status)) {
                    userHistory.push(report);
                }
            });

            userHistory.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : 0;
                const dateB = b.createdAt ? b.createdAt.toDate() : 0;
                return dateB - dateA;
            });

            if (userHistory.length === 0) { 
                historyList.innerHTML = '<p>Вы еще не отправляли ни одного отчета.</p>'; 
                return; 
            } 
            
            let historyHTML = ''; 
            userHistory.forEach(report => { 
                const date = report.checkDate && report.checkDate.toDate ? report.checkDate.toDate().toLocaleDateString('ru-RU') : 'дата не указана'; 
                const statusText = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' }[report.status] || report.status; 
                let commentHTML = ''; 
                if (report.status === 'rejected' && report.rejectionComment) { 
                    commentHTML = `<small class="rejection-comment"><b>Причина отклонения:</b> ${report.rejectionComment}</small>`; 
                } 
                historyHTML += `<li class="menu-list-item history-item">
                                    <div class="status-indicator ${report.status}"></div>
                                    <div>
                                        <strong>${report.locationName.replace(/^Б\d+\s*/, '')}</strong>
                                        <small>Дата: ${date} - Статус: ${statusText}</small>
                                        ${commentHTML}
                                    </div>
                                </li>`; 
            }); 
            historyList.innerHTML = historyHTML; 
        } catch (error) {
            console.error("Ошибка загрузки истории:", error);
            historyList.innerHTML = '<p>Не удалось загрузить историю проверок.</p>';
        }
    }
    
    // --- НАВИГАЦИЯ (без изменений) ---
    document.querySelectorAll('.menu-btn').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); const target = b.dataset.target; if (target === 'cooperation-screen') { renderAvailableSchedules(); showScreen(target); } else if (target === 'history-screen') { renderHistory(); showScreen(target); } else { showScreen(target); } }));
    document.querySelectorAll('.back-btn').forEach(b => b.addEventListener('click', (e) => { const target = e.currentTarget.dataset.target; showScreen(target); }));
    document.querySelectorAll('.admin-hub-btn').forEach(b => b.addEventListener('click', () => { const target = b.dataset.target; if(target === 'admin-schedule-screen') { loadCitiesForAdmin(); } if(target === 'admin-reports-screen') { renderAllReports(); } if(target === 'admin-users-screen') { renderAllUsers(); } showScreen(target); }));
    if(viewScheduleBtn) viewScheduleBtn.addEventListener('click', () => { renderSchedules(); showScreen('admin-view-schedule-screen'); });
});
