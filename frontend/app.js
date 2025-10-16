// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc",
  authDomain: "burzhuy-pro-v2.firebaseapp.com",
  projectId: "burzhuy-pro-v2",
  storageBucket: "burzhuy-pro-v2.firebasestorage.app",
  messagingSenderId: "627105413900",
  appId: "1:627105413900:web:3a02e926867ff76e256729"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// =================================================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ И ПЕРЕМЕННЫЕ
// =================================================================
let appState = {
    user: null,
    userData: null,
    unsubscribeUserListener: null // Храним функцию отписки от слушателя
};

let currentReportId = null;
let selectedScheduleForBooking = null;
const FAKE_EMAIL_DOMAIN = '@burzhuy-pro.app';

// =================================================================
// ОСНОВНЫЕ ХЕЛПЕРЫ (ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ)
// =================================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    } else {
        console.error(`Экран с ID "${screenId}" не найден.`);
    }
}

function showModal(title, text, type = 'alert', onConfirm = () => {}) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    modalTitle.textContent = title;
    modalText.innerHTML = text; // Используем innerHTML для поддержки тегов
    confirmBtn.textContent = (type === 'confirm') ? 'Подтвердить' : 'OK';
    cancelBtn.style.display = (type === 'confirm') ? 'inline-block' : 'none';

    // Клонирование кнопок для безопасного удаления старых обработчиков
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const closeModal = () => modalContainer.classList.add('modal-hidden');

    newConfirmBtn.addEventListener('click', () => {
        onConfirm(true);
        closeModal();
    }, { once: true });

    if (type === 'confirm') {
        newCancelBtn.addEventListener('click', () => {
            onConfirm(false);
            closeModal();
        }, { once: true });
    }

    modalContainer.classList.remove('modal-hidden');
}

// Форматирует название точки для пользователя (убирает код)
function formatLocationNameForUser(name) {
    if (!name) return 'Неизвестная точка';
    return name.replace(/^Б\d+\s/, '');
}

// Показывает/скрывает спиннер на кнопке
function toggleButtonSpinner(button, show) {
    if (show) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<div class="spinner-small"></div>';
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || 'Действие';
    }
}


// =================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Безопасное добавление обработчика для форматирования телефона
    const phoneInput = document.getElementById('phone-input');
    if (phoneInput) {
        const formatPhoneNumber = (value) => {
            let digits = value.replace(/\D/g, '');
            if (digits.startsWith('8')) digits = '7' + digits.substring(1);
            if (!digits.startsWith('7')) digits = '7' + digits;
            
            digits = digits.substring(0, 11);
            let formatted = '+7';
            if (digits.length > 1) formatted += ` (${digits.substring(1, 4)}`;
            if (digits.length > 4) formatted += `) ${digits.substring(4, 7)}`;
            if (digits.length > 7) formatted += `-${digits.substring(7, 9)}`;
            if (digits.length > 9) formatted += `-${digits.substring(9, 11)}`;
            
            return formatted;
        };
        phoneInput.addEventListener('input', (e) => { e.target.value = formatPhoneNumber(e.target.value); });
        phoneInput.value = '+7'; // Начальное значение
    }

    // Слушатель состояния аутентификации
    auth.onAuthStateChanged(user => {
        document.getElementById('loader').classList.remove('active');
        
        // Отписываемся от старого слушателя данных пользователя
        if (appState.unsubscribeUserListener) {
            appState.unsubscribeUserListener();
            appState.unsubscribeUserListener = null;
        }

        if (user) {
            appState.user = user;
            // Подписываемся на изменения данных пользователя в Firestore
            appState.unsubscribeUserListener = db.collection('users').doc(user.uid).onSnapshot(doc => {
                if (doc.exists) {
                    appState.userData = doc.data();
                    updateUIForUser(); // Обновляем интерфейс
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    appState.userData = null;
                    showScreen('profile-setup-screen'); // Пользователь есть, но профиля нет
                }
            }, err => {
                console.error("Ошибка при загрузке профиля:", err);
                showModal('Критическая ошибка', 'Не удалось загрузить данные профиля. Попробуйте перезагрузить страницу.');
            });
        } else {
            appState.user = null;
            appState.userData = null;
            showScreen('welcome-screen');
        }
    });

    // Функция обновления UI на основе данных пользователя
    function updateUIForUser() {
        if (!appState.userData) return;
        document.getElementById('user-name-display').textContent = appState.userData.fullName;
        document.querySelector('.dashboard-header .avatar').textContent = appState.userData.fullName?.charAt(0).toUpperCase() || '?';
        const isAdmin = appState.userData.role === 'admin';
        document.getElementById('admin-menu-btn').style.display = isAdmin ? 'flex' : 'none';
    }

    // Обработчик формы входа/регистрации
    document.getElementById('login-register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.currentTarget.querySelector('button[type="submit"]');
        const phoneValue = document.getElementById('phone-input').value;
        const password = document.getElementById('password-input').value;
        const digits = phoneValue.replace(/\D/g, '');
        
        if (digits.length !== 11) return showModal('Ошибка', 'Введите полный номер телефона.');
        if (password.length < 6) return showModal('Ошибка', 'Пароль должен быть не менее 6 символов.');
        
        const email = `+${digits}${FAKE_EMAIL_DOMAIN}`;
        toggleButtonSpinner(btn, true);

        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                // Если юзера нет, пробуем зарегистрировать
                try {
                    await auth.createUserWithEmailAndPassword(email, password);
                } catch (creationError) {
                    showModal('Ошибка регистрации', creationError.message);
                }
            } else {
                showModal('Ошибка входа', 'Неверный номер или пароль.');
            }
        } finally {
            toggleButtonSpinner(btn, false);
        }
    });

    // Обработчик формы создания профиля
    document.getElementById('profile-setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = appState.user;
        if (!user) return showModal('Ошибка', 'Сессия истекла, войдите снова.');
        
        const fullName = document.getElementById('profile-name-input').value.trim();
        if (!fullName) return showModal('Внимание', 'Введите ваше имя и фамилию.');
        
        const btn = e.currentTarget.querySelector('button[type="submit"]');
        toggleButtonSpinner(btn, true);

        try {
            await db.collection('users').doc(user.uid).set({
                fullName,
                phone: user.email.replace(FAKE_EMAIL_DOMAIN, ''),
                role: 'guest', // Роль по умолчанию
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (err) {
            console.error("Ошибка сохранения профиля: ", err);
            showModal('Ошибка', 'Не удалось сохранить профиль.');
        } finally {
            toggleButtonSpinner(btn, false);
        }
    });
    
    // Выход из аккаунта
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    // =================================================================
    // НАВИГАЦИЯ И ЗАГРУЗКА ДАННЫХ ДЛЯ ЭКРАНОВ
    // =================================================================
    const screenLoadFunctions = {
        'cooperation-screen': renderAvailableSchedules,
        'history-screen': renderHistory,
        'admin-hub-screen': loadAdminStats,
        'admin-schedule-screen': loadCitiesForAdmin,
        'admin-reports-screen': renderAllReports,
        'admin-users-screen': renderAllUsers,
        'admin-view-schedule-screen': renderSchedules,
    };

    document.querySelectorAll('.menu-btn, .back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetScreenId = e.currentTarget.dataset.target;
            if (!targetScreenId) return;
            
            // Вызываем функцию загрузки данных, если она есть для этого экрана
            const loadFunction = screenLoadFunctions[targetScreenId];
            if (loadFunction) {
                loadFunction();
            }
            showScreen(targetScreenId);
        });
    });

    // =================================================================
    // ФУНКЦИИ АДМИНИСТРАТОРА
    // =================================================================
    
    // Загрузка статистики для админ-панели
    async function loadAdminStats() {
        const container = document.getElementById('admin-stats-container');
        container.innerHTML = '<div class="spinner"></div>';
        try {
            const reportsPromise = db.collection('reports').where('status', '==', 'pending').get();
            const usersPromise = db.collection('users').get();
            const [reports, users] = await Promise.all([reportsPromise, usersPromise]);
            container.innerHTML = `
                <div class="stat-card"><h3>${reports.size}</h3><p>На проверке</p></div>
                <div class="stat-card"><h3>${users.size}</h3><p>Пользователей</p></div>`;
        } catch (e) {
            console.error("Ошибка загрузки статистики:", e);
            container.innerHTML = '<p class="error-message">Ошибка загрузки</p>';
        }
    }

    // Загрузка городов для формы создания расписания
    async function loadCitiesForAdmin() {
        const citySelect = document.getElementById('schedule-city-select');
        const locationSelect = document.getElementById('schedule-location-select');
        locationSelect.disabled = true;
        try {
            const snapshot = await db.collection('locations').get();
            const cities = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!cities[data.city]) cities[data.city] = [];
                cities[data.city].push(data.name);
            });
            citySelect.innerHTML = '<option value="" disabled selected>-- Выбор --</option>';
            Object.keys(cities).sort().forEach(city => citySelect.innerHTML += `<option value="${city}">${city}</option>`);
            
            citySelect.onchange = () => {
                const selectedCity = citySelect.value;
                locationSelect.innerHTML = '<option value="" disabled selected>-- ... --</option>';
                if (cities[selectedCity]) {
                    cities[selectedCity].sort().forEach(loc => locationSelect.innerHTML += `<option value="${loc}">${loc}</option>`);
                    locationSelect.disabled = false;
                } else {
                    locationSelect.disabled = true;
                }
            };
        } catch (e) {
            showModal("Ошибка", "Не удалось загрузить города.");
        }
    }
    
    // Форма создания новой проверки (расписания)
    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const city = form.querySelector('#schedule-city-select').value;
        const locationName = form.querySelector('#schedule-location-select').value;
        const date = form.querySelector('#schedule-date-input').value;
        const isUrgent = form.querySelector('#schedule-urgent-checkbox').checked;
        
        if (!city || !locationName || !date) return showModal('Ошибка', 'Заполните все поля.');
        
        const localDate = new Date(date);
        const dateForFirestore = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000));
        
        const btn = form.querySelector('button[type="submit"]');
        toggleButtonSpinner(btn, true);

        try {
            await db.collection('schedules').add({
                city,
                locationName,
                date: dateForFirestore,
                isUrgent,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isBooked: false
            });
            showModal('Успешно', 'Проверка создана.');
            form.reset();
            form.querySelector('#schedule-location-select').disabled = true;
        } catch (err) {
            console.error("Ошибка создания проверки:", err);
            showModal('Ошибка', 'Не удалось создать проверку.');
        } finally {
            toggleButtonSpinner(btn, false);
        }
    });

    // Рендер всех запланированных проверок для админа
    async function renderSchedules() {
        const list = document.getElementById('schedule-list');
        list.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('schedules').orderBy('date', 'desc').get();
            if (snapshot.empty) {
                list.innerHTML = '<p class="empty-state">Запланированных проверок нет.</p>';
                return;
            }
            let html = '<ul class="menu-list">';
            snapshot.forEach(doc => {
                const s = doc.data();
                const dateString = s.date.toDate().toLocaleDateString('ru-RU');
                html += `
                    <li class="menu-list-item">
                        <div>
                            <strong>${s.locationName} (${s.city})</strong>
                            <small>Дата: ${dateString} ${s.isUrgent ? '🔥' : ''}</small>
                        </div>
                        <button class="delete-btn" data-id="${doc.id}">&times;</button>
                    </li>`;
            });
            list.innerHTML = html + '</ul>';
            list.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSchedule(e.target.dataset.id);
            }));
        } catch (err) {
            console.error("Ошибка рендера расписаний:", err);
            list.innerHTML = '<p class="error-message">Ошибка загрузки расписаний.</p>';
        }
    }
    
    // Удаление проверки (расписания)
    function deleteSchedule(id) {
        showModal('Подтверждение', 'Удалить эту проверку?', 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    await db.collection('schedules').doc(id).delete();
                    showModal('Успешно', 'Проверка удалена.');
                    renderSchedules(); // Обновляем список
                } catch (err) {
                    showModal('Ошибка', 'Не удалось удалить проверку.');
                }
            }
        });
    }

    // Рендер всех отчетов для админа
    async function renderAllReports() {
        const list = document.getElementById('admin-reports-list');
        list.innerHTML = '<div class="spinner"></div>';
        try {
            const reportsSnap = await db.collection('reports').orderBy('createdAt', 'desc').get();
            if (reportsSnap.empty) {
                list.innerHTML = '<p class="empty-state">Отчетов пока нет.</p>';
                return;
            }

            const userIds = [...new Set(reportsSnap.docs.map(doc => doc.data().userId).filter(id => id))];
            const usersMap = new Map();
            if (userIds.length > 0) {
                const userDocsPromises = userIds.map(id => db.collection('users').doc(id).get());
                const userDocs = await Promise.all(userDocsPromises);
                userDocs.forEach(doc => {
                    if (doc.exists) usersMap.set(doc.id, doc.data());
                });
            }

            const statusMap = {
                pending: 'на проверке', approved: 'принят', rejected: 'отклонен',
                paid: 'оплачен', booked: 'забронирован'
            };

            let html = reportsSnap.docs.map(doc => {
                const r = doc.data();
                const user = usersMap.get(r.userId);
                return `
                    <li class="menu-list-item report-item" data-id="${doc.id}">
                        <div class="status-indicator ${r.status}"></div>
                        <div style="flex-grow: 1;">
                            <strong>${formatLocationNameForUser(r.locationName)}</strong>
                            <small>${user?.fullName || 'Агент'} - ${statusMap[r.status] || r.status}</small>
                        </div>
                        <button class="delete-report-btn" data-id="${doc.id}">Удалить</button>
                    </li>`;
            }).join('');
            
            list.innerHTML = `<ul class="menu-list">${html}</ul>`;

            list.querySelectorAll('.report-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('delete-report-btn')) return;
                    openAdminReportDetail(item.dataset.id);
                });
            });

            list.querySelectorAll('.delete-report-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteReport(e.target.dataset.id);
                });
            });
        } catch (e) {
            console.error(e);
            list.innerHTML = '<p class="error-message">Ошибка загрузки отчетов.</p>';
        }
    }

    // Удаление отчета
    function deleteReport(reportId) {
        showModal('Подтверждение', 'Удалить этот отчет безвозвратно?', 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    await db.collection('reports').doc(reportId).delete();
                    showModal('Успешно', 'Отчет удален.');
                    renderAllReports();
                } catch (err) {
                    showModal('Ошибка', 'Не удалось удалить отчет.');
                }
            }
        });
    }
    
    // Открытие деталей отчета для админа
    async function openAdminReportDetail(id) {
        currentReportId = id;
        showScreen('admin-report-detail-screen');
        const detailContainer = document.querySelector('#admin-report-detail-screen .scrollable-content');
        detailContainer.style.opacity = '0.5'; // Визуальный эффект загрузки
        try {
            const reportDoc = await db.collection('reports').doc(id).get();
            if (!reportDoc.exists) throw new Error("Отчет не найден");
            const report = reportDoc.data();
            
            let user = null;
            if (report.userId) {
                const userDoc = await db.collection('users').doc(report.userId).get();
                if (userDoc.exists) user = userDoc.data();
            }

            // Заполнение полей
            document.getElementById('admin-detail-address').textContent = report.locationName || '—';
            document.getElementById('admin-detail-user').textContent = user?.fullName || '—';
            document.getElementById('admin-detail-phone').textContent = user?.phone || '—';
            document.getElementById('admin-detail-date').textContent = report.checkDate?.toDate().toLocaleDateString('ru-RU') || '—';
            document.getElementById('admin-detail-status').innerHTML = `<span class="status-indicator ${report.status}"></span> ${report.status}`;

            const rejectionEl = document.getElementById('admin-detail-rejection-comment-container');
            if (report.status === 'rejected' && report.rejectionComment) {
                rejectionEl.style.display = 'block';
                rejectionEl.innerHTML = `<p><strong>Причина:</strong> ${report.rejectionComment}</p>`;
            } else {
                rejectionEl.style.display = 'none';
            }

            // Отображение всех 12 ответов
            for (let i = 1; i <= 12; i++) {
                const element = document.getElementById(`admin-detail-q${i}`);
                if (element) {
                    element.textContent = report.answers?.[`q${i}`] || '—';
                }
            }
            
            document.getElementById('admin-detail-photos').innerHTML = report.photoUrls?.map(url => `<a href="${url}" target="_blank"><img src="${url}" alt="фото-отчет"></a>`).join('') || '<p>Фото нет.</p>';
            
        } catch (err) {
            console.error("Ошибка загрузки деталей отчета: ", err);
            showModal('Ошибка', 'Не удалось загрузить отчет.');
            showScreen('admin-reports-screen'); // Возвращаем назад в случае ошибки
        } finally {
            detailContainer.style.opacity = '1';
        }
    }
    
    // Обновление статуса отчета админом
    async function updateReportStatus(status, comment = null) {
        if (!currentReportId) return;
        const updateData = { status };
        if (comment) updateData.rejectionComment = comment;

        try {
            const reportRef = db.collection('reports').doc(currentReportId);
            await reportRef.update(updateData);

            if (status === 'approved') {
                const reportDoc = await reportRef.get();
                const userId = reportDoc.data()?.userId;
                if (userId) {
                    await db.collection('users').doc(userId).update({
                        completedChecks: firebase.firestore.FieldValue.increment(1)
                    });
                }
            }
            showModal('Успешно', 'Статус обновлен.');
            openAdminReportDetail(currentReportId); // Обновляем детали
        } catch (err) {
            console.error("Ошибка обновления статуса: ", err);
            showModal('Ошибка', 'Не удалось обновить статус.');
        }
    }
    
    // Обработчики кнопок действий админа
    document.getElementById('admin-action-approve').addEventListener('click', () => updateReportStatus('approved'));
    document.getElementById('admin-action-paid').addEventListener('click', () => updateReportStatus('paid'));
    document.getElementById('admin-action-reject').addEventListener('click', () => {
        const modal = document.getElementById('rejection-modal-container');
        const confirmBtn = document.getElementById('rejection-modal-confirm-btn');
        const cancelBtn = document.getElementById('rejection-modal-cancel-btn');
        const commentInput = document.getElementById('rejection-comment-input');
        commentInput.value = '';
        modal.classList.remove('modal-hidden');

        // Очистка старых обработчиков
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        const confirmHandler = () => {
            if (commentInput.value.trim()) {
                updateReportStatus('rejected', commentInput.value.trim());
                modal.classList.add('modal-hidden');
            } else {
                alert('Укажите причину.');
            }
        };

        newConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        newCancelBtn.addEventListener('click', () => modal.classList.add('modal-hidden'), { once: true });
    });

    // Рендер всех пользователей
    async function renderAllUsers() {
        const list = document.getElementById('admin-users-list');
        list.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('users').orderBy('fullName').get();
            if (snapshot.empty) {
                list.innerHTML = '<p class="empty-state">Пользователей не найдено.</p>';
                return;
            }
            
            list.innerHTML = snapshot.docs.map(doc => {
                const user = doc.data();
                const isAdmin = user.role === 'admin';
                return `
                    <div class="user-card">
                        <div class="user-card-header">
                            <div class="user-card-avatar">${user.fullName?.charAt(0).toUpperCase() || '?'}</div>
                            <div class="user-card-info">
                                <strong>
                                    ${user.fullName || 'Без имени'}
                                    ${isAdmin ? '<span class="admin-badge">АДМИН</span>' : ''}
                                </strong>
                                <small>${user.phone || 'Нет телефона'}</small>
                            </div>
                        </div>
                        <div class="user-card-actions">
                            <button class="role-toggle-btn" data-id="${doc.id}" data-role="${user.role}" data-name="${user.fullName}">
                                ${isAdmin ? 'Понизить' : 'Сделать админом'}
                            </button>
                            <button class="delete-user-btn" data-id="${doc.id}" data-name="${user.fullName}">
                                Удалить
                            </button>
                        </div>
                    </div>`;
            }).join('');
            
            list.querySelectorAll('.role-toggle-btn').forEach(btn => btn.addEventListener('click', e => toggleUserRole(e.target.dataset.id, e.target.dataset.role, e.target.dataset.name)));
            list.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', e => deleteUser(e.target.dataset.id, e.target.dataset.name)));
        } catch (error) {
            console.error("Ошибка загрузки пользователей:", error);
            list.innerHTML = '<p class="error-message">Ошибка загрузки пользователей.</p>';
        }
    }

    // Смена роли пользователя
    function toggleUserRole(id, role, name) {
        const newRole = role === 'admin' ? 'guest' : 'admin';
        const actionText = newRole === 'admin' ? 'администратором' : 'агентом';
        showModal('Подтверждение', `Сделать пользователя ${name} ${actionText}?`, 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    await db.collection('users').doc(id).update({ role: newRole });
                    renderAllUsers(); // Обновляем список
                } catch (err) {
                    showModal('Ошибка', 'Не удалось сменить роль.');
                }
            }
        });
    }

    // Удаление пользователя
    function deleteUser(id, name) {
        showModal('Подтверждение', `Удалить пользователя ${name}? Это действие нельзя отменить.`, 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    await db.collection('users').doc(id).delete();
                    renderAllUsers(); // Обновляем список
                } catch (err) {
                    // ВАЖНО: Функцию для удаления пользователя из Firebase Auth нужно вызывать из бэкенда (Cloud Functions)
                    // Прямое удаление из клиента требует недавнего входа пользователя.
                    // Пока просто удаляем из Firestore.
                    showModal('Ошибка', 'Не удалось удалить пользователя из базы данных.');
                }
            }
        });
    }

    // =================================================================
    // ФУНКЦИИ ПОЛЬЗОВАТЕЛЯ
    // =================================================================

    // Рендер доступных для записи проверок
    async function renderAvailableSchedules() {
        const list = document.getElementById('schedule-cards-list');
        const noSchedulesView = document.getElementById('no-schedules-view');
        list.innerHTML = '<div class="spinner"></div>';
        noSchedulesView.style.display = 'none';

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // ПРАВИЛЬНЫЙ ЗАПРОС С ИНДЕКСОМ: isBooked (asc), date (asc)
            const snapshot = await db.collection('schedules')
                .where('isBooked', '==', false)
                .where('date', '>=', today)
                .orderBy('date')
                .get();

            if (snapshot.empty) {
                list.innerHTML = '';
                noSchedulesView.style.display = 'block';
                return;
            }

            list.innerHTML = snapshot.docs.map(doc => {
                const s = doc.data();
                return `
                    <li class="menu-list-item" data-id="${doc.id}">
                        ${s.isUrgent ? '<div class="urgent-badge">🔥</div>' : ''}
                        <div>
                            <strong>${formatLocationNameForUser(s.locationName)}</strong>
                            <small>${s.city} - ${s.date.toDate().toLocaleDateString('ru-RU')}</small>
                        </div>
                    </li>`;
            }).join('');

            list.querySelectorAll('.menu-list-item').forEach(card => card.addEventListener('click', () => openTimePicker(card.dataset.id)));
        } catch (error) {
            console.error("ОШИБКА FIRESTORE при загрузке расписаний:", error);
            list.innerHTML = '<p class="error-message">Не удалось загрузить данные. Убедитесь, что создан композитный индекс для коллекции `schedules` по полям `isBooked` (по возрастанию) и `date` (по возрастанию).</p>';
        }
    }

    // Открытие экрана выбора времени
    async function openTimePicker(id) {
        try {
            const doc = await db.collection('schedules').doc(id).get();
            if (!doc.exists || doc.data().isBooked) {
                showModal('Ошибка', 'Эта проверка больше недоступна.');
                renderAvailableSchedules(); // Обновляем список, так как он устарел
                return;
            }
            selectedScheduleForBooking = { id: doc.id, ...doc.data() };
            document.getElementById('picker-location-title').textContent = formatLocationNameForUser(selectedScheduleForBooking.locationName);
            document.getElementById('time-picker-form').reset();
            showScreen('time-picker-screen');
        } catch (error) {
            showModal('Ошибка', 'Не удалось получить данные о проверке.');
        }
    }

    // Форма подтверждения записи на проверку
    document.getElementById('time-picker-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const startTime = document.getElementById('user-start-time').value;
        const endTime = document.getElementById('user-end-time').value;
        const user = appState.user;
        
        if (!user) return showModal('Ошибка', 'Нет активного пользователя.');
        if (!startTime || !endTime) return showModal('Ошибка', 'Укажите интервал времени.');
        if (startTime >= endTime) return showModal('Ошибка', 'Время начала должно быть раньше окончания.');
        
        const btn = e.currentTarget.querySelector('button[type="submit"]');
        toggleButtonSpinner(btn, true);

        const scheduleRef = db.collection('schedules').doc(selectedScheduleForBooking.id);
        const reportRef = db.collection('reports').doc(); // Генерируем новый ID для отчета
        
        try {
            // Используем транзакцию для атомарного бронирования
            await db.runTransaction(async t => {
                const scheduleDoc = await t.get(scheduleRef);
                if (scheduleDoc.data()?.isBooked) {
                    throw new Error("Проверка уже забронирована другим агентом.");
                }
                t.update(scheduleRef, { isBooked: true });
                t.set(reportRef, {
                    userId: user.uid,
                    scheduleId: selectedScheduleForBooking.id,
                    locationName: selectedScheduleForBooking.locationName,
                    city: selectedScheduleForBooking.city,
                    checkDate: selectedScheduleForBooking.date,
                    startTime,
                    endTime,
                    status: 'booked',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            await loadUserDashboard(user.uid);
            showModal('Успешно!', 'Вы записались. Задание появилось на главном экране.', 'alert', () => showScreen('main-menu-screen'));
        } catch (err) {
            showModal('Ошибка бронирования', err.message);
            renderAvailableSchedules(); // Обновляем список доступных проверок
        } finally {
            toggleButtonSpinner(btn, false);
        }
    });

    // Загрузка активных заданий пользователя на главный экран
    async function loadUserDashboard(userId) {
        const container = document.getElementById('dashboard-info-container');
        container.innerHTML = '';
        try {
            const snapshot = await db.collection('reports')
                .where('userId', '==', userId)
                .where('status', '==', 'booked')
                .get();
                
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state"><p>У вас нет активных заданий.</p></div>';
                return;
            }
            
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tasks.sort((a, b) => a.checkDate.toDate() - b.checkDate.toDate());
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            container.innerHTML = '<h3>Активные задания:</h3><ul class="menu-list">' + tasks.map(report => {
                const checkDate = report.checkDate.toDate();
                const canFill = checkDate.getTime() <= today.getTime();
                return `
                    <li class="menu-list-item">
                        <div>
                            <strong>${formatLocationNameForUser(report.locationName)}</strong>
                            <small>${checkDate.toLocaleDateString('ru-RU')}</small>
                            <div class="task-actions">
                                <button class="btn-fill-checklist" data-id="${report.id}" ${canFill ? '' : 'disabled'}>Заполнить</button>
                                <button class="btn-cancel-booking" data-id="${report.id}">Отменить</button>
                            </div>
                        </div>
                    </li>`;
            }).join('') + '</ul>';
            
            container.querySelectorAll('.btn-fill-checklist').forEach(btn => btn.addEventListener('click', e => openChecklist(e.target.dataset.id)));
            container.querySelectorAll('.btn-cancel-booking').forEach(btn => btn.addEventListener('click', e => cancelBooking(e.target.dataset.id)));
        } catch (error) {
            console.error("Ошибка загрузки заданий пользователя:", error);
            container.innerHTML = '<p class="error-message">Ошибка загрузки заданий.</p>';
        }
    }
    
    // Отмена бронирования
    function cancelBooking(id) {
        showModal('Подтверждение', 'Отменить эту проверку?', 'confirm', async (confirmed) => {
            if (confirmed) {
                try {
                    const user = appState.user;
                    if (!user) throw new Error("Пользователь не найден");
                    
                    const reportRef = db.collection('reports').doc(id);
                    const reportDoc = await reportRef.get();
                    const scheduleId = reportDoc.data()?.scheduleId;
                    
                    const batch = db.batch();
                    batch.delete(reportRef);
                    if (scheduleId) {
                        const scheduleRef = db.collection('schedules').doc(scheduleId);
                        batch.update(scheduleRef, { isBooked: false });
                    }
                    await batch.commit();
                    
                    showModal('Успешно', 'Запись отменена.');
                    loadUserDashboard(user.uid);
                } catch (e) {
                    console.error("Ошибка отмены бронирования:", e);
                    showModal('Ошибка', 'Не удалось отменить запись.');
                }
            }
        });
    }

    // Открытие чек-листа (для нового или редактируемого отчета)
    async function openChecklist(id, isEdit = false) {
        try {
            const doc = await db.collection('reports').doc(id).get();
            if (!doc.exists) return showModal('Ошибка', 'Задание не найдено.');
            
            currentReportId = id;
            const report = doc.data();
            
            // Заполняем заголовок
            document.getElementById('checklist-address').textContent = formatLocationNameForUser(report.locationName);
            document.getElementById('checklist-date').textContent = report.checkDate.toDate().toLocaleDateString('ru-RU');
            
            const form = document.getElementById('checklist-form');
            form.reset();
            
            // Если это редактирование, заполняем поля формы
            if (isEdit && report.answers) {
                for(let i = 1; i <= 12; i++) {
                    const element = form.querySelector(`#checklist-q${i}`);
                    if (element) {
                        element.value = report.answers[`q${i}`] || '';
                    }
                }
            }
            showScreen('checklist-screen');
        } catch (error) {
            showModal('Ошибка', `Не удалось загрузить ${isEdit ? 'данные для редактирования' : 'чек-лист'}.`);
        }
    }

    // Форма отправки чек-листа
    document.getElementById('checklist-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = appState.user;
        if (!user || !currentReportId) return;

        const btn = e.currentTarget.querySelector('button[type="submit"]');
        toggleButtonSpinner(btn, true);

        try {
            const answers = {};
            for (let i = 1; i <= 12; i++) {
                answers[`q${i}`] = document.getElementById(`checklist-q${i}`).value.trim();
            }

            const files = document.getElementById('checklist-photos').files;
            const reportRef = db.collection('reports').doc(currentReportId);
            
            const originalReportDoc = await reportRef.get();
            const originalReportData = originalReportDoc.data() || {};
            const isEditing = originalReportData.status === 'rejected';
            
            let photoUrls = originalReportData.photoUrls || [];

            if (files.length > 0) {
                // Если добавлены новые файлы, перезаписываем старые
                photoUrls = []; 
                for (const file of files) {
                    const filePath = `reports/${currentReportId}/${Date.now()}_${file.name}`;
                    const fileSnapshot = await storage.ref(filePath).put(file);
                    photoUrls.push(await fileSnapshot.ref.getDownloadURL());
                }
            } else if (photoUrls.length === 0) {
                // Если фото не было и новых не добавили
                throw new Error("Пожалуйста, прикрепите фото.");
            }
            
            await reportRef.update({
                answers,
                photoUrls,
                status: 'pending',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectionComment: firebase.firestore.FieldValue.delete() // Удаляем причину отклонения
            });

            const modalTitle = isEditing ? 'Отчет исправлен!' : 'Отчет отправлен на проверку!';
            showModal(modalTitle, 'Спасибо! Мы свяжемся с вами после проверки отчета.', 'alert', () => {
                showScreen('main-menu-screen');
                loadUserDashboard(user.uid);
            });
        } catch (err) {
            showModal('Ошибка', err.message);
        } finally {
            toggleButtonSpinner(btn, false);
        }
    });

    // Рендер истории проверок пользователя
    async function renderHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '<div class="spinner"></div>';
        const user = appState.user;
        if (!user) return;

        try {
            const snapshot = await db.collection('reports')
                .where('userId', '==', user.uid)
                .where('status', 'in', ['pending', 'approved', 'rejected', 'paid'])
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) {
                list.innerHTML = '<p class="empty-state">История проверок пуста.</p>';
                return;
            }

            const statusMap = {
                pending: 'на проверке', approved: 'принят',
                rejected: 'отклонен', paid: 'оплачен'
            };

            let html = snapshot.docs.map(doc => {
                const r = doc.data();
                const comment = (r.status === 'rejected' && r.rejectionComment) ? 
                    `<small class="rejection-comment"><b>Причина:</b> ${r.rejectionComment}</small>` : '';
                const editButton = (r.status === 'rejected') ? 
                    `<div class="task-actions"><button class="btn-edit-report" data-id="${doc.id}">Редактировать</button></div>` : '';
                return `
                    <li class="menu-list-item">
                        <div class="status-indicator ${r.status}"></div>
                        <div style="flex-grow: 1;">
                            <strong>${formatLocationNameForUser(r.locationName)}</strong>
                            <small>Статус: ${statusMap[r.status]}</small>
                            ${comment}
                            ${editButton}
                        </div>
                    </li>`;
            }).join('');
            
            list.innerHTML = `<ul class="menu-list">${html}</ul>`;

            list.querySelectorAll('.btn-edit-report').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openChecklist(e.target.dataset.id, true); // Вызываем с флагом редактирования
                });
            });

        } catch (error) {
            console.error("Ошибка загрузки истории:", error);
            list.innerHTML = '<p class="error-message">Ошибка загрузки истории.</p>';
        }
    }
});
