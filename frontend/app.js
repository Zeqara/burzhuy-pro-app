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
};
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

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('phone-input');

    // Маска и автоподстановка +7
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

        phoneInput.addEventListener('input', (e) => {
            e.target.value = formatPhoneNumber(e.target.value);
        });
        
        phoneInput.value = '+7';
    }
    
    // --- ГЛАВНЫЙ КОНТРОЛЛЕР (СОСТОЯНИЕ АУТЕНТИФИКАЦИИ) ---
    auth.onAuthStateChanged(user => {
        document.getElementById('loader').classList.remove('active');
        if (user) {
            db.collection('users').doc(user.uid).onSnapshot(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    const userAvatar = document.querySelector('.dashboard-header .avatar');
                    document.getElementById('user-name-display').textContent = userData.fullName;
                    if (userAvatar && userData.fullName) {
                        userAvatar.textContent = userData.fullName.charAt(0).toUpperCase();
                    }
                    document.getElementById('admin-menu-btn').style.display = (userData.role === 'admin') ? 'flex' : 'none';
                    if (userData.role === 'admin') loadAdminStats();
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            }, err => {
                showModal('Критическая ошибка', 'Не удалось загрузить данные профиля.');
            });
        } else {
            document.getElementById('admin-menu-btn').style.display = 'none';
            showScreen('auth-screen');
        }
    });

    // --- ЛОГИКА АУТЕНТИФИКАЦИИ ---
    const loginRegisterForm = document.getElementById('login-register-form');
    if (loginRegisterForm) {
        loginRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const loginRegisterBtn = document.getElementById('login-register-btn');
            const digitsOnly = phoneInput.value.replace(/\D/g, '');
            if (digitsOnly.length !== 11) {
                return showModal('Ошибка', 'Введите полный номер телефона.');
            }
            const password = document.getElementById('password-input').value;
            if (password.length < 6) {
                return showModal('Ошибка', 'Пароль должен быть не менее 6 символов.');
            }
            const email = `+${digitsOnly}@burzhuy-pro.app`;
            
            loginRegisterBtn.disabled = true;
            loginRegisterBtn.innerHTML = '<div class="spinner-small"></div> Вход...';

            try {
                await auth.createUserWithEmailAndPassword(email, password);
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    try {
                        await auth.signInWithEmailAndPassword(email, password);
                    } catch (signInError) {
                        showModal('Ошибка входа', 'Неверный номер или пароль.');
                    }
                } else {
                    showModal('Ошибка регистрации', error.message);
                }
            } finally {
                loginRegisterBtn.disabled = false;
                loginRegisterBtn.textContent = 'Продолжить';
            }
        });
    }

    const profileSetupForm = document.getElementById('profile-setup-form');
    if (profileSetupForm) {
        profileSetupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const fullName = document.getElementById('profile-name-input').value.trim();
            if (!user) return showModal('Ошибка', 'Сессия истекла, войдите снова.');
            if (!fullName) return showModal('Внимание', 'Введите ваше имя и фамилию.');
            
            const submitBtn = profileSetupForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner-small"></div> Сохранение...';

            try {
                const phoneNumber = user.email.replace('@burzhuy-pro.app', '');
                await db.collection('users').doc(user.uid).set({
                    fullName, phone: phoneNumber, role: 'guest', completedChecks: 0
                });
            } catch (err) {
                showModal('Ошибка', 'Не удалось сохранить профиль.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Сохранить и войти';
            }
        });
    }

    document.getElementById('logout-btn').addEventListener('click', () => { auth.signOut(); });

    // --- ЕДИНАЯ НАВИГАЦИЯ ---
    document.querySelectorAll('.menu-btn, .back-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.currentTarget.dataset.target;
            if (!target) return;

            switch(target) {
                case 'cooperation-screen': renderAvailableSchedules(); break;
                case 'history-screen': renderHistory(); break;
                case 'admin-hub-screen': loadAdminStats(); break;
                case 'admin-schedule-screen': loadCitiesForAdmin(); break;
                case 'admin-reports-screen': renderAllReports(); break;
                case 'admin-users-screen': renderAllUsers(); break;
            }
            showScreen(target);
        });
    });

    document.getElementById('view-schedule-btn').addEventListener('click', () => {
        renderSchedules();
        showScreen('admin-view-schedule-screen');
    });
    
    // --- ЛОГИКА АДМИН-ПАНЕЛИ ---
    async function loadAdminStats() {
        const statsContainer = document.getElementById('admin-stats-container');
        if (!statsContainer) return;
        statsContainer.innerHTML = '<div class="spinner"></div>';
        try {
            const reportsSnapshot = await db.collection('reports').where('status', '==', 'pending').get();
            const usersSnapshot = await db.collection('users').get();
            statsContainer.innerHTML = `
                <div class="stat-card"><h3>${reportsSnapshot.size}</h3><p>На проверке</p></div>
                <div class="stat-card"><h3>${usersSnapshot.size}</h3><p>Пользователей</p></div>
            `;
        } catch (error) {
            statsContainer.innerHTML = '<p>Ошибка загрузки статистики.</p>';
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
            citySelect.innerHTML = '<option value="" disabled selected>-- Выберите город --</option>';
            Object.keys(cities).sort().forEach(city => citySelect.innerHTML += `<option value="${city}">${city}</option>`);
            
            citySelect.onchange = () => {
                const selectedCity = citySelect.value;
                locationSelect.innerHTML = '<option value="" disabled selected>-- Выберите точку --</option>';
                if (selectedCity && cities[selectedCity]) {
                    cities[selectedCity].sort().forEach(loc => locationSelect.innerHTML += `<option value="${loc}">${loc}</option>`);
                    locationSelect.disabled = false;
                } else {
                    locationSelect.disabled = true;
                }
            };
        } catch (error) {
            showModal("Ошибка", "Не удалось загрузить города.");
        }
    }

    document.getElementById('schedule-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const city = document.getElementById('schedule-city-select').value;
        const locationName = document.getElementById('schedule-location-select').value;
        const date = document.getElementById('schedule-date-input').value;
        const isUrgent = document.getElementById('schedule-urgent-checkbox').checked;
        if (!city || !locationName || !date) return showModal('Ошибка', 'Заполните все поля.');
        const btn = e.currentTarget.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            await db.collection('schedules').add({ city, locationName, date: new Date(date), isUrgent, createdAt: firebase.firestore.FieldValue.serverTimestamp(), isBooked: false });
            showModal('Успешно', 'Проверка создана.');
            e.target.reset();
            document.getElementById('schedule-location-select').disabled = true;
        } catch(err) { showModal('Ошибка', 'Не удалось создать проверку.'); } finally { btn.disabled = false; }
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
            list.innerHTML = html + '</ul>';
            list.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => deleteSchedule(e.target.dataset.id)));
        } catch (error) {
            list.innerHTML = '<p>Ошибка загрузки.</p>';
        }
    }
    
    function deleteSchedule(id) {
        showModal('Подтверждение', 'Удалить эту проверку?', 'confirm', confirmed => {
            if (confirmed) {
                db.collection('schedules').doc(id).delete().then(renderSchedules).catch(() => showModal('Ошибка', 'Не удалось удалить.'));
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
            if(userIds.length > 0) {
                const userDocs = await Promise.all(userIds.map(id => db.collection('users').doc(id).get()));
                userDocs.forEach(doc => { if(doc.exists) usersMap.set(doc.id, doc.data()) });
            }
            
            let html = reportsSnap.docs.map(doc => {
                const r = doc.data();
                const user = usersMap.get(r.userId);
                const statusMap = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен', booked: 'забронирован' };
                return `<li class="menu-list-item" data-id="${doc.id}"><div class="status-indicator ${r.status}"></div><div><strong>${r.locationName}</strong><small>${user?.fullName || 'Агент'} - ${statusMap[r.status] || r.status}</small></div></li>`;
            }).join('');
            list.innerHTML = html;

            list.querySelectorAll('.menu-list-item').forEach(item => item.addEventListener('click', () => openAdminReportDetail(item.dataset.id)));
        } catch (error) {
            console.error("Ошибка загрузки отчетов:", error);
            list.innerHTML = '<p>Ошибка загрузки отчетов.</p>';
        }
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

            for(let i = 1; i <= 9; i++) {
                document.getElementById(`admin-detail-q${i}`).textContent = report.answers?.[`q${i}`] || '—';
            }
            document.getElementById('admin-detail-photos').innerHTML = report.photoUrls?.map(url => `<a href="${url}" target="_blank"><img src="${url}" alt="фото-отчет"></a>`).join('') || '<p>Фото нет.</p>';
        } catch(err) {
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
        confirmBtn.addEventListener('click', confirmHandler, { once: true });
        cancelBtn.addEventListener('click', () => modal.classList.add('modal-hidden'), { once: true });
    });
    
    async function updateReportStatus(status, comment = null) {
        if (!currentReportId) return;
        const updateData = { status };
        if (comment) updateData.rejectionComment = comment;
        try {
            const reportRef = db.collection('reports').doc(currentReportId);
            await reportRef.update(updateData);
            if(status === 'approved') {
                const userId = (await reportRef.get()).data().userId;
                if(userId) await db.collection('users').doc(userId).update({ completedChecks: firebase.firestore.FieldValue.increment(1) });
            }
            showModal('Успешно', 'Статус обновлен.');
            openAdminReportDetail(currentReportId);
            renderAllReports(); // Обновляем общий список
        } catch(err) { showModal('Ошибка', 'Не удалось обновить статус.'); }
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
            if(confirmed) db.collection('users').doc(id).update({ role: newRole }).then(renderAllUsers);
        });
    }

    function deleteUser(id, name) {
        showModal('Подтверждение', `Удалить пользователя ${name}? Действие нельзя отменить.`, 'confirm', confirmed => {
            if(confirmed) db.collection('users').doc(id).delete().then(renderAllUsers);
        });
    }

    // --- ЛОГИКА АГЕНТА ---
    async function renderAvailableSchedules() {
        const list = document.getElementById('schedule-cards-list');
        const noSchedulesView = document.getElementById('no-schedules-view');
        list.innerHTML = '<div class="spinner"></div>';
        noSchedulesView.style.display = 'none';
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const snapshot = await db.collection('schedules').where('date', '>=', today).where('isBooked', '==', false).orderBy('date').get();
            if (snapshot.empty) {
                list.innerHTML = '';
                noSchedulesView.style.display = 'block';
                return;
            }
            list.innerHTML = snapshot.docs.map(doc => {
                const s = doc.data();
                return `<li class="menu-list-item" data-id="${doc.id}">${s.isUrgent ? '<div class="urgent-badge">🔥 Срочно</div>' : ''}<div><strong>${s.locationName}</strong><small>${s.city} - ${s.date.toDate().toLocaleDateString('ru-RU')}</small></div></li>`;
            }).join('');
            list.querySelectorAll('.menu-list-item').forEach(card => card.addEventListener('click', () => openTimePicker(card.dataset.id)));
        } catch (error) {
            list.innerHTML = '<p>Не удалось загрузить данные.</p>';
        }
    }

    async function openTimePicker(id) {
        try {
            const doc = await db.collection('schedules').doc(id).get();
            if (!doc.exists || doc.data().isBooked) {
                showModal('Ошибка', 'Эта проверка больше недоступна.');
                renderAvailableSchedules();
                return;
            }
            selectedScheduleForBooking = { id: doc.id, ...doc.data() };
            document.getElementById('picker-location-title').textContent = selectedScheduleForBooking.locationName;
            document.getElementById('time-picker-form').reset();
            showScreen('time-picker-screen');
        } catch (error) {
            showModal('Ошибка', 'Не удалось получить данные о проверке.');
        }
    }

    document.getElementById('time-picker-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const startTime = document.getElementById('user-start-time').value;
        const endTime = document.getElementById('user-end-time').value;
        const user = auth.currentUser;
        if (!startTime || !endTime) return showModal('Ошибка', 'Укажите интервал времени.');
        if (startTime >= endTime) return showModal('Ошибка', 'Время начала должно быть раньше окончания.');
        const btn = e.currentTarget.querySelector('button[type="submit"]');
        btn.disabled = true;
        const scheduleRef = db.collection('schedules').doc(selectedScheduleForBooking.id);
        const reportRef = db.collection('reports').doc();
        try {
            await db.runTransaction(async t => {
                if ((await t.get(scheduleRef)).data().isBooked) throw new Error("Проверка уже забронирована.");
                t.update(scheduleRef, { isBooked: true });
                t.set(reportRef, { userId: user.uid, scheduleId: selectedScheduleForBooking.id, locationName: selectedScheduleForBooking.locationName, city: selectedScheduleForBooking.city, checkDate: selectedScheduleForBooking.date, startTime, endTime, status: 'booked', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            });
            await loadUserDashboard(user.uid);
            showModal('Успешно!', 'Вы записались. Задание на главном экране.', 'alert', () => showScreen('main-menu-screen'));
        } catch(err) { showModal('Ошибка', err.message); } finally { btn.disabled = false; renderAvailableSchedules(); }
    });

    async function loadUserDashboard(userId) {
        const container = document.getElementById('dashboard-info-container');
        container.innerHTML = '';
        try {
            const snapshot = await db.collection('reports').where('userId', '==', userId).where('status', '==', 'booked').get();
            if (snapshot.empty) {
                container.innerHTML = '<div class="empty-state"><p>У вас нет активных заданий.</p></div>';
                return;
            }
            let tasks = [];
            snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
            tasks.sort((a,b) => a.checkDate.toDate() - b.checkDate.toDate());

            container.innerHTML = '<h3>Ваши активные задания:</h3>' + tasks.map(report => {
                const checkDate = report.checkDate.toDate();
                const today = new Date(); today.setHours(0,0,0,0);
                const canFill = checkDate.getTime() <= today.getTime();
                return `<li class="menu-list-item"><div><strong>${report.locationName}</strong><small>${checkDate.toLocaleDateString('ru-RU')}</small><div class="task-actions"><button class="btn-fill-checklist" data-id="${report.id}" ${canFill ? '' : 'disabled'}>Заполнить</button><button class="btn-cancel-booking" data-id="${report.id}">Отменить</button></div></div></li>`;
            }).join('');
            container.querySelectorAll('.btn-fill-checklist').forEach(btn => btn.addEventListener('click', e => openChecklist(e.target.dataset.id)));
            container.querySelectorAll('.btn-cancel-booking').forEach(btn => btn.addEventListener('click', e => cancelBooking(e.target.dataset.id)));
        } catch (error) {
            container.innerHTML = '<p>Ошибка загрузки заданий.</p>';
        }
    }

    async function cancelBooking(id) {
        showModal('Подтверждение', 'Отменить эту проверку?', 'confirm', async confirmed => {
            if (confirmed) {
                try {
                    const reportDoc = await db.collection('reports').doc(id).get();
                    const scheduleId = reportDoc.data().scheduleId;
                    const batch = db.batch();
                    batch.delete(db.collection('reports').doc(id));
                    if (scheduleId) batch.update(db.collection('schedules').doc(scheduleId), { isBooked: false });
                    await batch.commit();
                    showModal('Успешно', 'Запись отменена.');
                    loadUserDashboard(auth.currentUser.uid);
                } catch (error) {
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
            document.getElementById('checklist-address').textContent = report.locationName;
            document.getElementById('checklist-date').textContent = report.checkDate.toDate().toLocaleDateString('ru-RU');
            document.getElementById('checklist-form').reset();
            showScreen('checklist-screen');
        } catch (error) {
            showModal('Ошибка', 'Не удалось загрузить чек-лист.');
        }
    }

    document.getElementById('checklist-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !currentReportId) return;
        const btn = e.currentTarget.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            const answers = {};
            for(let i = 1; i <= 9; i++) {
                const el = document.getElementById(`checklist-q${i}-...`); // ИСПРАВЬТЕ ID ПОЛЕЙ ВВОДА
                if(el) answers[`q${i}`] = el.value;
            }
            const files = document.getElementById('checklist-photos').files;
            if (files.length === 0) throw new Error("Прикрепите фото.");
            const photoUrls = [];
            for (const file of files) {
                const filePath = `reports/${currentReportId}/${Date.now()}_${file.name}`;
                const fileSnapshot = await storage.ref(filePath).put(file);
                photoUrls.push(await fileSnapshot.ref.getDownloadURL());
            }
            await db.collection('reports').doc(currentReportId).update({ answers, photoUrls, status: 'pending', submittedAt: firebase.firestore.FieldValue.serverTimestamp() });
            showModal('Отчет отправлен!', 'Спасибо!', 'alert', () => { showScreen('main-menu-screen'); loadUserDashboard(user.uid); });
        } catch(err) { showModal('Ошибка', err.message); } finally { btn.disabled = false; }
    });

    async function renderHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '<div class="spinner"></div>';
        const user = auth.currentUser;
        if (!user) return;
        try {
            const snapshot = await db.collection('reports').where('userId', '==', user.uid).where('status', 'in', ['pending', 'approved', 'rejected', 'paid']).orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                list.innerHTML = '<p class="empty-state">История проверок пуста.</p>';
                return;
            }
            list.innerHTML = snapshot.docs.map(doc => {
                const r = doc.data();
                const statusMap = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' };
                const comment = (r.status === 'rejected' && r.rejectionComment) ? `<small class="rejection-comment"><b>Причина:</b> ${r.rejectionComment}</small>` : '';
                return `<li class="menu-list-item"><div class="status-indicator ${r.status}"></div><div><strong>${r.locationName}</strong><small>Статус: ${statusMap[r.status]}</small>${comment}</div></li>`;
            }).join('');
        } catch (error) {
            list.innerHTML = '<p>Ошибка загрузки истории.</p>';
        }
    }
});
