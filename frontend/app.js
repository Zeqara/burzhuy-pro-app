// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc",
  authDomain: "burzhuy-pro-v2.firebaseapp.com",
  projectId: "burzhuy-pro-v2",
  storageBucket: "burzhuy-pro-v2.firebasestorage.app",
  messagingSenderId: "627105413900",
  appId: "1:627105413900:web:3a02e926867ff76e256729",
  measurementId: "G-VZJQET0HSW"
};

// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Централизованное состояние приложения
let appState = {
    user: null,
    userData: null,
    unsubscribeUserListener: null
};

// Глобальные переменные для отслеживания состояний
let currentReportId = null;

const FAKE_EMAIL_DOMAIN = '@burzhuy-pro.app';

// =================================================================
// ГЛАВНЫЕ ФУНКЦИИ (ХЕЛПЕРЫ)
// =================================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

function showModal(title, text, type = 'alert', onConfirm = () => {}) {
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    
    modalTitle.textContent = title;
    modalText.innerHTML = text;
    confirmBtn.textContent = (type === 'confirm') ? 'Подтвердить' : 'OK';
    cancelBtn.style.display = (type === 'confirm') ? 'inline-block' : 'none';

    // Пересоздаем кнопки, чтобы удалить старые обработчики событий
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    newConfirmBtn.addEventListener('click', () => { onConfirm(true); modalContainer.classList.add('modal-hidden'); }, { once: true });
    if (type === 'confirm') {
        newCancelBtn.addEventListener('click', () => { onConfirm(false); modalContainer.classList.add('modal-hidden'); }, { once: true });
    }
    
    modalContainer.classList.remove('modal-hidden');
}

function formatLocationNameForUser(name) {
    if (!name) return '';
    return name.replace(/^Б\d+\s/, ''); // Убирает код точки (например, "Б52 ") из начала
}

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Форматирование номера телефона при вводе
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
        phoneInput.value = '+7';
    }

    // Переход со стартового экрана к авторизации
    const startMissionButton = document.getElementById('start-mission-button');
    if (startMissionButton) {
        startMissionButton.addEventListener('click', () => showScreen('auth-screen'));
    }
    
    // Главный обработчик состояния авторизации пользователя
    auth.onAuthStateChanged(user => {
        document.getElementById('loader').classList.remove('active');
        if (appState.unsubscribeUserListener) {
            appState.unsubscribeUserListener();
            appState.unsubscribeUserListener = null;
        }

        if (user) {
            appState.user = user;
            appState.unsubscribeUserListener = db.collection('users').doc(user.uid).onSnapshot(doc => {
                if (doc.exists) {
                    appState.userData = doc.data();
                    document.getElementById('user-name-display').textContent = appState.userData.fullName;
                    document.querySelector('.dashboard-header .avatar').textContent = appState.userData.fullName?.charAt(0).toUpperCase() || '?';
                    const isAdmin = appState.userData.role === 'admin';
                    document.getElementById('admin-menu-btn').style.display = isAdmin ? 'flex' : 'none';
                    if (isAdmin) loadAdminStats();
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    appState.userData = null;
                    showScreen('profile-setup-screen');
                }
            }, err => {
                console.error("Ошибка при загрузке профиля:", err);
                showModal('Критическая ошибка', 'Не удалось загрузить данные профиля.');
            });
        } else {
            appState.user = null;
            appState.userData = null;
            document.getElementById('admin-menu-btn').style.display = 'none';
            showScreen('welcome-screen');
        }
    });

    // Форма входа/регистрации
    document.getElementById('login-register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('login-register-btn');
        const phoneInputValue = document.getElementById('phone-input').value;
        const digits = phoneInputValue.replace(/\D/g, '');
        const password = document.getElementById('password-input').value;
        if (digits.length !== 11) return showModal('Ошибка', 'Введите полный номер телефона.');
        if (password.length < 6) return showModal('Ошибка', 'Пароль должен быть не менее 6 символов.');
        
        const email = `${digits}${FAKE_EMAIL_DOMAIN}`;
        
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small"></div>';
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            // Проверяем, является ли ошибка ошибкой "неверный логин/пароль" или "пользователь не найден"
            const isLoginFailure =
                error.code === 'auth/user-not-found' ||
                error.code === 'auth/wrong-password' ||
                error.code === 'auth/invalid-credential' ||
                (error.code === 'auth/internal-error' && error.message && error.message.includes('INVALID_LOGIN_CREDENTIALS'));

            if (isLoginFailure) {
                // Если войти не удалось, пробуем создать нового пользователя
                try {
                    await auth.createUserWithEmailAndPassword(email, password);
                } catch (creationError) {
                    console.error("Ошибка СОЗДАНИЯ пользователя:", creationError);
                    showModal('Ошибка регистрации', creationError.message);
                }
            } else {
                console.error("Ошибка ВХОДА:", error);
                showModal('Ошибка входа', 'Произошла непредвиденная ошибка.');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Продолжить';
        }
    });

    // Форма завершения регистрации (ввод имени)
    document.getElementById('profile-setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = appState.user;
        const fullName = document.getElementById('profile-name-input').value.trim();
        if (!user) return showModal('Ошибка', 'Сессия истекла, войдите снова.');
        if (!fullName) return showModal('Внимание', 'Введите ваше имя и фамилию.');
        const btn = e.currentTarget.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            await db.collection('users').doc(user.uid).set({
                fullName,
                phone: user.email.replace(FAKE_EMAIL_DOMAIN, ''),
                role: 'guest',
                completedChecks: 0
            });
        } catch (err) {
            showModal('Ошибка', 'Не удалось сохранить профиль.');
        } finally {
            btn.disabled = false;
        }
    });

    // Кнопка выхода
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

    // Навигация по экранам
    document.querySelectorAll('.menu-btn, .back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.dataset.target;
            if (!target) return;
            const loadFunctions = {
                'cooperation-screen': renderAvailableSchedules,
                'history-screen': renderHistory,
                'admin-hub-screen': loadAdminStats,
                'admin-schedule-screen': loadCitiesForAdmin,
                'admin-reports-screen': renderAllReports,
                'admin-users-screen': renderAllUsers,
                'checklist-instruction-screen': renderChecklistInstruction,
                'admin-checklist-instruction-screen': loadChecklistInstructionForAdmin,
            };
            loadFunctions[target]?.();
            showScreen(target);
        });
    });

    document.getElementById('view-schedule-btn').addEventListener('click', () => {
        renderSchedules();
        showScreen('admin-view-schedule-screen');
    });

    // =================================================================
    // ФУНКЦИИ АДМИНИСТРАТОРА
    // =================================================================
    async function loadAdminStats() {
        const container = document.getElementById('admin-stats-container');
        container.innerHTML = '<div class="spinner"></div>';
        try {
            const reports = await db.collection('reports').where('status', '==', 'pending').get();
            const users = await db.collection('users').get();
            container.innerHTML = `<div class="stat-card"><h3>${reports.size}</h3><p>На проверке</p></div><div class="stat-card"><h3>${users.size}</h3><p>Пользователей</p></div>`;
        } catch (e) {
            container.innerHTML = '<p>Ошибка загрузки статистики.</p>';
        }
    }

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
                locationSelect.innerHTML = '<option value="" disabled selected>-- ... --</option>';
                cities[citySelect.value]?.sort().forEach(loc => locationSelect.innerHTML += `<option value="${loc}">${loc}</option>`);
                locationSelect.disabled = false;
            };
        } catch (e) {
            showModal("Ошибка", "Не удалось загрузить города.");
        }
    }

    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const city = form.querySelector('#schedule-city-select').value;
        const locationName = form.querySelector('#schedule-location-select').value;
        const date = form.querySelector('#schedule-date-input').value;
        const startTime = form.querySelector('#schedule-start-time').value;
        const endTime = form.querySelector('#schedule-end-time').value;
        const isUrgent = form.querySelector('#schedule-urgent-checkbox').checked;

        if (!city || !locationName || !date || !startTime || !endTime) {
            return showModal('Ошибка', 'Заполните все поля, включая время.');
        }
        if (startTime >= endTime) {
            return showModal('Ошибка', 'Время начала должно быть раньше окончания.');
        }

        const localDate = new Date(date);
        const dateForFirestore = new Date(localDate.getTime() + (localDate.getTimezoneOffset() * 60000));

        await db.collection('schedules').add({
            city,
            locationName,
            date: dateForFirestore,
            startTime,
            endTime,
            isUrgent,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isBooked: false
        });
        showModal('Успешно', 'Проверка создана.');
        form.reset();
        document.getElementById('schedule-location-select').disabled = true;
    });

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
                html += `<li class="menu-list-item"><div><strong>${s.locationName} (${s.city})</strong><small>Дата: ${s.date.toDate().toLocaleDateString('ru-RU')} ${s.isUrgent ? '🔥' : ''}</small></div><button class="delete-btn" data-id="${doc.id}">&times;</button></li>`;
            });
            html += '</ul>';
            list.innerHTML = html;
            list.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => deleteSchedule(e.target.dataset.id)));
        } catch (error) {
            list.innerHTML = '<p>Ошибка загрузки графика.</p>';
        }
    }

    function deleteSchedule(id) {
        showModal('Подтверждение', 'Удалить эту проверку?', 'confirm', confirmed => {
            if (confirmed) {
                db.collection('schedules').doc(id).delete().then(renderSchedules).catch(err => showModal('Ошибка', 'Не удалось удалить проверку.'));
            }
        });
    }

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
                const userDocs = await Promise.all(userIds.map(id => db.collection('users').doc(id).get()));
                userDocs.forEach(doc => {
                    if (doc.exists) usersMap.set(doc.id, doc.data())
                });
            }
            let html = reportsSnap.docs.map(doc => {
                const r = doc.data();
                const user = usersMap.get(r.userId);
                const statusMap = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен', booked: 'забронирован' };
                return `<li class="menu-list-item report-item" data-id="${doc.id}">
                    <div class="status-indicator ${r.status}"></div>
                    <div style="flex-grow: 1;"><strong>${r.locationName}</strong><small>${user?.fullName || 'Агент'} - ${statusMap[r.status] || r.status}</small></div>
                    <button class="delete-report-btn" data-id="${doc.id}">Удалить</button>
                </li>`;
            }).join('');
            list.innerHTML = html;
            list.querySelectorAll('.report-item').forEach(item => item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-report-btn')) {
                    openAdminReportDetail(item.dataset.id);
                }
            }));
            list.querySelectorAll('.delete-report-btn').forEach(btn => btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteReport(e.target.dataset.id);
            }));
        } catch (e) {
            console.error(e);
            list.innerHTML = '<p>Ошибка загрузки отчетов.</p>';
        }
    }

    function deleteReport(reportId) {
        showModal('Подтверждение', 'Удалить этот отчет безвозвратно?', 'confirm', confirmed => {
            if (confirmed) {
                db.collection('reports').doc(reportId).delete()
                    .then(() => {
                        showModal('Успешно', 'Отчет удален.');
                        renderAllReports();
                    })
                    .catch(() => showModal('Ошибка', 'Не удалось удалить отчет.'));
            }
        });
    }

    async function openAdminReportDetail(id) {
        currentReportId = id;
        showScreen('admin-report-detail-screen');
        const detailContainer = document.querySelector('#admin-report-detail-screen .scrollable-content');
        detailContainer.style.opacity = '0.5';
        try {
            const reportDoc = await db.collection('reports').doc(id).get();
            if (!reportDoc.exists) throw new Error("Отчет не найден");
            const report = reportDoc.data();
            const userDoc = report.userId ? await db.collection('users').doc(report.userId).get() : null;
            const user = userDoc?.exists ? userDoc.data() : null;

            document.getElementById('admin-detail-address').textContent = report.locationName || '—';
            document.getElementById('admin-detail-user').textContent = user?.fullName || '—';
            document.getElementById('admin-detail-phone').textContent = user?.phone || '—';
            document.getElementById('admin-detail-date').textContent = report.checkDate?.toDate().toLocaleDateString('ru-RU') || '—';
            document.getElementById('admin-detail-status').innerHTML = `<span class="status-indicator ${report.status}"></span> ${report.status}`;

            const rejectionEl = document.getElementById('admin-detail-rejection-comment-container');
            rejectionEl.style.display = (report.status === 'rejected' && report.rejectionComment) ? 'block' : 'none';
            if (report.rejectionComment) rejectionEl.innerHTML = `<p><strong>Причина:</strong> ${report.rejectionComment}</p>`;

            for (let i = 1; i <= 12; i++) {
                document.getElementById(`admin-detail-q${i}`).textContent = report.answers?.[`q${i}`] || '—';
            }
            document.getElementById('admin-detail-photos').innerHTML = report.photoUrls?.map(url => `<a href="${url}" target="_blank"><img src="${url}" alt="фото-отчет"></a>`).join('') || '<p>Фото нет.</p>';
        } catch (err) {
            showModal('Ошибка', 'Не удалось загрузить отчет.');
            showScreen('admin-reports-screen');
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
            if (commentInput.value.trim()) {
                updateReportStatus('rejected', commentInput.value.trim());
                modal.classList.add('modal-hidden');
            } else {
                alert('Укажите причину.');
            }
        };
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        newCancelBtn.addEventListener('click', () => modal.classList.add('modal-hidden'), { once: true });
    });

    async function updateReportStatus(status, comment = null) {
        if (!currentReportId) return;
        const updateData = { status };
        if (comment) updateData.rejectionComment = comment;
        try {
            const reportRef = db.collection('reports').doc(currentReportId);
            await reportRef.update(updateData);
            if (status === 'approved') {
                const reportData = (await reportRef.get()).data();
                if (reportData.userId && reportData.status !== 'approved') { // Prevent multiple increments
                    await db.collection('users').doc(reportData.userId).update({ completedChecks: firebase.firestore.FieldValue.increment(1) });
                }
            }
            showModal('Успешно', 'Статус обновлен.');
            openAdminReportDetail(currentReportId);
        } catch (err) {
            showModal('Ошибка', 'Не удалось обновить статус.');
        }
    }

    async function renderAllUsers() {
        const list = document.getElementById('admin-users-list');
        list.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('users').get();
            if (snapshot.empty) {
                list.innerHTML = '<p class="empty-state">Пользователей не найдено.</p>';
                return;
            }
            list.innerHTML = snapshot.docs.map(doc => {
                const user = doc.data();
                const isAdmin = user.role === 'admin';
                return `<div class="user-card">
                    <div class="user-card-header">
                        <div class="user-card-avatar">${user.fullName?.charAt(0).toUpperCase() || '?'}</div>
                        <div><strong>${user.fullName || 'Без имени'} ${isAdmin ? '(Админ)' : ''}</strong><small>${user.phone || 'Нет телефона'}</small></div>
                    </div>
                    <div class="user-card-actions">
                        <button class="role-toggle-btn ${isAdmin ? 'admin' : ''}" data-id="${doc.id}" data-role="${user.role}" data-name="${user.fullName}">${isAdmin ? 'Понизить' : 'Сделать админом'}</button>
                        <button class="delete-user-btn" data-id="${doc.id}" data-name="${user.fullName}">Удалить</button>
                    </div>
                </div>`;
            }).join('');
            list.querySelectorAll('.role-toggle-btn').forEach(btn => btn.addEventListener('click', e => toggleUserRole(e.target.dataset.id, e.target.dataset.role, e.target.dataset.name)));
            list.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', e => deleteUser(e.target.dataset.id, e.target.dataset.name)));
        } catch (error) {
            list.innerHTML = '<p>Ошибка загрузки пользователей.</p>';
        }
    }

    function toggleUserRole(id, role, name) {
        const newRole = role === 'admin' ? 'guest' : 'admin';
        showModal('Подтверждение', `Сделать ${name} ${newRole === 'admin' ? 'администратором' : 'агентом'}?`, 'confirm', confirmed => {
            if (confirmed) db.collection('users').doc(id).update({ role: newRole }).then(renderAllUsers);
        });
    }

    function deleteUser(id, name) {
        showModal('Подтверждение', `Удалить пользователя ${name}? Действие нельзя отменить.`, 'confirm', confirmed => {
            if (confirmed) db.collection('users').doc(id).delete().then(renderAllUsers);
        });
    }

    // =================================================================
    // ФУНКЦИИ АГЕНТА (ПОЛЬЗОВАТЕЛЯ)
    // =================================================================
    async function renderAvailableSchedules() {
        const list = document.getElementById('schedule-cards-list');
        const noSchedulesView = document.getElementById('no-schedules-view');
        list.innerHTML = '<div class="spinner"></div>';
        noSchedulesView.style.display = 'none';
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const snapshot = await db.collection('schedules').where('isBooked', '==', false).where('date', '>=', today).orderBy('date').get();
            if (snapshot.empty) {
                list.innerHTML = '';
                noSchedulesView.style.display = 'block';
                return;
            }
            list.innerHTML = snapshot.docs.map(doc => {
                const s = doc.data();
                const dateStr = s.date.toDate().toLocaleDateString('ru-RU');
                const timeStr = (s.startTime && s.endTime) ? ` (${s.startTime} - ${s.endTime})` : '';
                
                return `<li class="menu-list-item" data-id="${doc.id}">${s.isUrgent ? '<div class="urgent-badge">🔥</div>' : ''}<div><strong>${formatLocationNameForUser(s.locationName)}</strong><small>${s.city} - ${dateStr}${timeStr}</small></div></li>`;
            }).join('');
            
            list.querySelectorAll('.menu-list-item').forEach(card => {
                card.addEventListener('click', () => confirmAndBookSchedule(card.dataset.id));
            });
        } catch (error) {
            console.error("ОШИБКА FIRESTORE: Убедитесь, что вы создали КОМБИНИРОВАННЫЙ ИНДЕКС для коллекции 'schedules' по полям 'isBooked' и 'date'.", error);
            list.innerHTML = '<p>Не удалось загрузить данные.</p>';
        }
    }

    async function confirmAndBookSchedule(scheduleId) {
        try {
            const user = appState.user;
            if (!user) return showModal('Ошибка', 'Нет активного пользователя.');

            const scheduleRef = db.collection('schedules').doc(scheduleId);
            const scheduleDoc = await scheduleRef.get();

            if (!scheduleDoc.exists || scheduleDoc.data().isBooked) {
                showModal('Ошибка', 'Эта проверка больше недоступна.');
                renderAvailableSchedules();
                return;
            }
            
            const scheduleData = { id: scheduleDoc.id, ...scheduleDoc.data() };
            const dateStr = scheduleData.date.toDate().toLocaleDateString('ru-RU');
            const timeStr = `${scheduleData.startTime} - ${scheduleData.endTime}`;
            
            const confirmationText = `
                <b>Адрес:</b> ${formatLocationNameForUser(scheduleData.locationName)}<br>
                <b>Дата:</b> ${dateStr}<br>
                <b>Время:</b> ${timeStr}
            `;

            showModal('Подтвердить запись?', confirmationText, 'confirm', async (confirmed) => {
                if (!confirmed) return;

                const reportRef = db.collection('reports').doc();
                try {
                    await db.runTransaction(async t => {
                        const freshScheduleDoc = await t.get(scheduleRef);
                        if (freshScheduleDoc.data().isBooked) throw new Error("Проверка уже забронирована другим агентом.");
                        
                        t.update(scheduleRef, { isBooked: true });
                        t.set(reportRef, {
                            userId: user.uid,
                            scheduleId: scheduleData.id,
                            locationName: scheduleData.locationName,
                            city: scheduleData.city,
                            checkDate: scheduleData.date,
                            startTime: scheduleData.startTime,
                            endTime: scheduleData.endTime,
                            status: 'booked',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });

                    await loadUserDashboard(user.uid);
                    showModal('Успешно!', 'Вы записались. Задание появилось на главном экране.', 'alert', () => showScreen('main-menu-screen'));
                } catch (err) {
                    showModal('Ошибка', err.message);
                    renderAvailableSchedules();
                }
            });

        } catch (error) {
            showModal('Ошибка', 'Не удалось получить данные о проверке.');
        }
    }

    async function loadUserDashboard(userId) {
        const container = document.getElementById('dashboard-info-container');
        container.innerHTML = '';
        try {
            const snapshot = await db.collection('reports').where('userId', '==', userId).where('status', '==', 'booked').get();
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state"><p>У вас нет активных проверок.</p></div>';
                return;
            }
            let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tasks.sort((a, b) => a.checkDate.toDate() - b.checkDate.toDate());

            container.innerHTML = '<h3>Активные проверки</h3><ul class="menu-list">' + tasks.map(report => {
                const checkDate = report.checkDate.toDate();
                const canFill = checkDate.getTime() <= new Date().setHours(23, 59, 59, 999);
                return `<li class="menu-list-item">
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
            container.innerHTML = '<p>Ошибка загрузки заданий.</p>';
        }
    }

    function cancelBooking(id) {
        showModal('Подтверждение', 'Отменить эту проверку?', 'confirm', async confirmed => {
            if (confirmed) {
                try {
                    const user = appState.user;
                    if (!user) throw new Error("Пользователь не найден");
                    const reportDoc = await db.collection('reports').doc(id).get();
                    const scheduleId = reportDoc.data().scheduleId;
                    const batch = db.batch();
                    batch.delete(db.collection('reports').doc(id));
                    if (scheduleId) batch.update(db.collection('schedules').doc(scheduleId), { isBooked: false });
                    await batch.commit();
                    showModal('Успешно', 'Запись отменена.');
                    loadUserDashboard(user.uid);
                } catch (e) {
                    showModal('Ошибка', 'Не удалось отменить запись.');
                }
            }
        });
    }

    async function openChecklist(id) {
        try {
            const doc = await db.collection('reports').doc(id).get();
            if (!doc.exists) return showModal('Ошибка', 'Задание не найдено.');
            currentReportId = id;
            const report = doc.data();
            document.getElementById('checklist-address').textContent = formatLocationNameForUser(report.locationName);
            document.getElementById('checklist-date').textContent = report.checkDate.toDate().toLocaleDateString('ru-RU');
            document.getElementById('checklist-form').reset();
            showScreen('checklist-screen');
        } catch (error) {
            showModal('Ошибка', 'Не удалось загрузить чек-лист.');
        }
    }

    async function openChecklistForEdit(id) {
        try {
            const doc = await db.collection('reports').doc(id).get();
            if (!doc.exists) return showModal('Ошибка', 'Отчет не найден.');
            currentReportId = id;
            const report = doc.data();
            document.getElementById('checklist-address').textContent = formatLocationNameForUser(report.locationName);
            document.getElementById('checklist-date').textContent = report.checkDate.toDate().toLocaleDateString('ru-RU');
            const form = document.getElementById('checklist-form');
            form.reset();

            if (report.answers) {
                for(let i = 1; i <= 12; i++) {
                    const element = form.querySelector(`#checklist-q${i}`);
                    if (element) element.value = report.answers[`q${i}`] || '';
                }
            }
            showScreen('checklist-screen');
        } catch (error) {
            showModal('Ошибка', 'Не удалось загрузить данные для редактирования.');
        }
    }

    document.getElementById('checklist-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = appState.user;
        if (!user || !currentReportId) return;

        const btn = e.currentTarget.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small"></div>';
        try {
            const answers = {};
            for (let i = 1; i <= 12; i++) {
                answers[`q${i}`] = document.getElementById(`checklist-q${i}`).value;
            }

            const files = document.getElementById('checklist-photos').files;
            const reportRef = db.collection('reports').doc(currentReportId);
            const originalReportDoc = await reportRef.get();
            const isEditing = originalReportDoc.exists && originalReportDoc.data().answers;
            let photoUrls = originalReportDoc.data().photoUrls || [];

            if (files.length > 0) {
                photoUrls = []; // Перезаписываем фото, если добавлены новые
                for (const file of files) {
                    const filePath = `reports/${currentReportId}/${Date.now()}_${file.name}`;
                    const fileSnapshot = await storage.ref(filePath).put(file);
                    photoUrls.push(await fileSnapshot.ref.getDownloadURL());
                }
            } else if (photoUrls.length === 0) { // Требуем фото только если их еще нет
                throw new Error("Пожалуйста, прикрепите фото.");
            }

            await reportRef.update({
                answers,
                photoUrls,
                status: 'pending',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectionComment: firebase.firestore.FieldValue.delete()
            });

            const modalTitle = isEditing ? 'Отчет исправлен!' : 'Отправлен на проверку!';
            showModal(modalTitle, 'Спасибо! 😊 Мы свяжемся с вами после проверки отчёта. Если он не будет принят — потребуется его редактирование. Когда статус заказа изменится на «Принят», наш менеджер свяжется с вами 📞.', 'alert', () => {
                showScreen('main-menu-screen');
                loadUserDashboard(user.uid);
            });
        } catch (err) {
            showModal('Ошибка', err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Отправить';
        }
    });

    async function renderHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '<div class="spinner"></div>';
        const user = appState.user;
        if (!user) return;
        try {
            const snapshot = await db.collection('reports').where('userId', '==', user.uid).where('status', 'in', ['pending', 'approved', 'rejected', 'paid']).orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                list.innerHTML = '<p class="empty-state">История проверок пуста.</p>';
                return;
            }
            let html = '<ul class="menu-list">';
            html += snapshot.docs.map(doc => {
                const r = doc.data();
                const statusMap = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' };
                const comment = (r.status === 'rejected' && r.rejectionComment) ? `<small style="color:var(--status-rejected); display:block; margin-top:5px;"><b>Причина:</b> ${r.rejectionComment}</small>` : '';
                const editButton = (r.status === 'rejected') ? `<div class="task-actions"><button class="btn-edit-report" data-id="${doc.id}">Редактировать</button></div>` : '';

                return `<li class="menu-list-item">
                            <div class="status-indicator ${r.status}"></div>
                            <div style="flex-grow: 1;">
                                <strong>${formatLocationNameForUser(r.locationName)}</strong>
                                <small>Статус: ${statusMap[r.status]}</small>
                                ${comment}
                                ${editButton}
                            </div>
                        </li>`;
            }).join('');
            html += '</ul>';
            list.innerHTML = html;

            list.querySelectorAll('.btn-edit-report').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openChecklistForEdit(e.target.dataset.id);
                });
            });

        } catch (error) {
            list.innerHTML = '<p>Ошибка загрузки истории.</p>';
        }
    }

    // =================================================================
    // ФУНКЦИОНАЛ ИНСТРУКЦИИ ПО ЧЕК-ЛИСТУ
    // =================================================================
    async function renderChecklistInstruction() {
        const container = document.getElementById('checklist-instruction-content');
        container.innerHTML = '<div class="spinner"></div>';
        try {
            const docRef = db.collection('content').doc('checklistInstruction');
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                container.innerHTML = '<p class="empty-state">Инструкция еще не заполнена.</p>';
                return;
            }

            const data = docSnap.data();
            let html = '';
            if (data.title) html += `<h3>${data.title}</h3>`;
            if (data.description) html += `<p>${data.description}</p><hr>`;

            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    html += `<div class="instruction-item">
                            <h4>${item.question || 'Вопрос'}</h4>
                            <p><strong>Пример ответа:</strong><br>${item.answer || 'Нет примера'}</p>
                            ${item.imageUrl ? `<img src="${item.imageUrl}" alt="Пример фото">` : ''}
                        </div>`;
                });
            }
            container.innerHTML = html;
        } catch (error) {
            console.error("Ошибка загрузки инструкции чек-листа:", error);
            container.innerHTML = '<p>Не удалось загрузить инструкцию.</p>';
        }
    }

    let instructionItemCounter = 0;

    function createInstructionItemForm(item = {}, index) {
        return `<div class="instruction-form-item" data-index="${index}">
                <div class="form-group">
                    <label>Вопрос</label>
                    <input type="text" class="ci-item-question" value="${item.question || ''}" required>
                </div>
                <div class="form-group">
                    <label>Пример ответа</label>
                    <textarea class="ci-item-answer" rows="3" required>${item.answer || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Пример фото</label>
                    ${item.imageUrl ? `<img src="${item.imageUrl}" style="max-width: 100px; display: block; margin-bottom: 10px;">` : ''}
                    <input type="file" class="ci-item-photo" accept="image/*">
                    <input type="hidden" class="ci-item-photo-url" value="${item.imageUrl || ''}">
                </div>
                <button type="button" class="btn-secondary delete-instruction-item-btn">Удалить</button>
            </div>`;
    }

    document.getElementById('add-instruction-item-btn').addEventListener('click', () => {
        const container = document.getElementById('checklist-instruction-items-container');
        container.insertAdjacentHTML('beforeend', createInstructionItemForm({}, instructionItemCounter));
        instructionItemCounter++;
    });

    document.getElementById('checklist-instruction-items-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-instruction-item-btn')) {
            e.target.closest('.instruction-form-item').remove();
        }
    });

    async function loadChecklistInstructionForAdmin() {
        const form = document.getElementById('checklist-instruction-form');
        const container = document.getElementById('checklist-instruction-items-container');
        instructionItemCounter = 0;
        container.innerHTML = '<div class="spinner"></div>';
        try {
            const docSnap = await db.collection('content').doc('checklistInstruction').get();
            if (docSnap.exists) {
                const data = docSnap.data();
                form.querySelector('#ci-title').value = data.title || '';
                form.querySelector('#ci-description').value = data.description || '';
                
                let itemsHtml = '';
                if (data.items && data.items.length > 0) {
                    data.items.forEach((item, index) => {
                        itemsHtml += createInstructionItemForm(item, index);
                        instructionItemCounter = Math.max(instructionItemCounter, index + 1);
                    });
                }
                container.innerHTML = itemsHtml;
            } else {
                 container.innerHTML = '';
            }
        } catch (error) {
            console.error("Ошибка загрузки инструкции для админа:", error);
            container.innerHTML = '<p>Не удалось загрузить данные для редактирования.</p>';
        }
    }

    document.getElementById('checklist-instruction-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small"></div>';

        try {
            const title = document.getElementById('ci-title').value;
            const description = document.getElementById('ci-description').value;
            const items = [];
            const itemForms = document.querySelectorAll('.instruction-form-item');
            
            const uploadPromises = [];

            itemForms.forEach((form, index) => {
                const question = form.querySelector('.ci-item-question').value;
                const answer = form.querySelector('.ci-item-answer').value;
                const photoInput = form.querySelector('.ci-item-photo');
                const currentPhotoUrl = form.querySelector('.ci-item-photo-url').value;

                const itemData = { question, answer, imageUrl: currentPhotoUrl };
                items.push(itemData);

                if (photoInput.files[0]) {
                    const file = photoInput.files[0];
                    const filePath = `instructions/${Date.now()}_${file.name}`;
                    const uploadTask = storage.ref(filePath).put(file).then(snapshot => snapshot.ref.getDownloadURL());
                    uploadPromises.push(uploadTask.then(downloadURL => { items[index].imageUrl = downloadURL; }));
                }
            });

            await Promise.all(uploadPromises);
            await db.collection('content').doc('checklistInstruction').set({ title, description, items });
            showModal('Успешно', 'Инструкция по чек-листу сохранена.');

        } catch (error) {
            console.error("Ошибка сохранения инструкции:", error);
            showModal('Ошибка', 'Не удалось сохранить инструкцию.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Сохранить инструкцию';
        }
    });
});
