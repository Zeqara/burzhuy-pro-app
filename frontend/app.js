// =================================================================
// ФИНАЛЬНАЯ ВЕРСИЯ СКРИПТА ПРИЛОЖЕНИЯ (v7.2 - ИСПРАВЛЕНИЕ АВТОРИЗАЦИИ И ОТПРАВКИ ОТЧЕТА)
// Включает: ВСЕ функции, ВСЕ исправления, без сокращений.
// =================================================================

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

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let appState = { user: null, userData: null, unsubscribeUserListener: null };
let currentReportId = null;
const FAKE_EMAIL_DOMAIN = '@burzhuy-pro.app';

// =================================================================
// ГЛАВНЫЕ ФУНКЦИИ (ХЕЛПЕРЫ)
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

function formatLocationNameForUser(name) {
    return name ? name.replace(/^Б\d+\s/, '') : '';
}

function getRatingBadgeHtml(rating) {
    if (typeof rating !== 'number') return '';
    const colorClass = rating >= 85 ? 'green' : rating >= 60 ? 'yellow' : 'red';
    return `<span class="rating-badge ${colorClass}">${rating}%</span>`;
}

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
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

    document.getElementById('start-mission-button').addEventListener('click', () => showScreen('auth-screen'));
    
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

    // =================================================================
    // ИСПРАВЛЕНИЕ №1: Не работает авторизация
    // =================================================================
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
            // Успешный вход, onAuthStateChanged обработает остальное
        } catch (error) {
            // Более детальная обработка ошибок
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                // Если пользователь не найден, пытаемся его создать
                try {
                    await auth.createUserWithEmailAndPassword(email, password);
                    // Успешное создание, onAuthStateChanged перенаправит на создание профиля
                } catch (creationError) {
                    console.error("Ошибка при создании пользователя:", creationError);
                    showModal('Ошибка регистрации', 'Не удалось создать аккаунт. Возможно, пароль слишком слабый или произошла другая ошибка.');
                }
            } else if (error.code === 'auth/wrong-password') {
                // Если пароль неверный
                showModal('Ошибка входа', 'Неверный пароль. Пожалуйста, попробуйте еще раз.');
            } else {
                // Все остальные ошибки
                console.error("Непредвиденная ошибка входа:", error);
                showModal('Ошибка входа', 'Произошла непредвиденная ошибка. Пожалуйста, попробуйте позже.');
            }
        } finally {
            btn.disabled = false;
            btn.textContent = 'Продолжить';
        }
    });


    document.getElementById('profile-setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = appState.user;
        const fullName = document.getElementById('profile-name-input').value.trim();
        if (!user || !fullName) return;
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

    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

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
            container.innerHTML = '<p>Ошибка</p>';
        }
    }

    async function loadCitiesForAdmin() {
        const citySelect = document.getElementById('schedule-city-select');
        const locationSelect = document.getElementById('schedule-location-select');
        citySelect.innerHTML = '<option value="" disabled selected>-- Загрузка городов... --</option>';
        locationSelect.innerHTML = '<option value="" disabled selected>-- Сначала выберите город --</option>';
        locationSelect.disabled = true;
        try {
            const citiesSnapshot = await db.collection('cities').orderBy('name').get();
            citySelect.innerHTML = '<option value="" disabled selected>-- Выберите город --</option>';
            if (citiesSnapshot.empty) {
                citySelect.innerHTML = '<option value="" disabled selected>-- Городов не найдено --</option>';
                return;
            }
            citiesSnapshot.forEach(doc => {
                const cityName = doc.data().name;
                citySelect.innerHTML += `<option value="${cityName}">${cityName}</option>`;
            });
            citySelect.onchange = async () => {
                const selectedCity = citySelect.value;
                if (!selectedCity) return;
                locationSelect.innerHTML = '<option value="" disabled selected>-- Загрузка точек... --</option>';
                locationSelect.disabled = true;
                try {
                    const locationsSnapshot = await db.collection('locations').where('city', '==', selectedCity).orderBy('name').get();
                    locationSelect.innerHTML = '<option value="" disabled selected>-- Выберите точку --</option>';
                    if (locationsSnapshot.empty) {
                        locationSelect.innerHTML = '<option value="" disabled selected>-- Точек не найдено --</option>';
                        return;
                    }
                    locationsSnapshot.forEach(doc => {
                        const locationName = doc.data().name;
                        locationSelect.innerHTML += `<option value="${locationName}">${locationName}</option>`;
                    });
                    locationSelect.disabled = false;
                } catch (error) {
                    console.error("Ошибка загрузки точек:", error);
                    showModal("Ошибка", "Не удалось загрузить список точек для этого города.");
                }
            };
        } catch (error) {
            console.error("Ошибка загрузки городов:", error);
            showModal("Ошибка", "Не удалось загрузить список городов. Проверьте коллекцию 'cities'.");
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

        const dateForFirestore = new Date(date);

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
                const statusMap = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен', booked: 'забронирован', cancelled: 'отменен' };
                const ratingBadge = getRatingBadgeHtml(r.rating);
                return `<li class="menu-list-item report-item" data-id="${doc.id}">
                    <div class="status-indicator ${r.status}"></div>
                    <div style="flex-grow: 1;"><strong>${r.locationName} ${ratingBadge}</strong><small>${user?.fullName || 'Агент'} - ${statusMap[r.status] || r.status}</small></div>
                    <button class="delete-report-btn" data-id="${doc.id}">Удалить</button>
                </li>`;
            }).join('');
            list.innerHTML = html;
            list.querySelectorAll('.report-item').forEach(item => item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-report-btn')) openAdminReportDetail(item.dataset.id);
            }));
            list.querySelectorAll('.delete-report-btn').forEach(btn => btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteReport(e.target.dataset.id);
            }));
        } catch (e) {
            console.error("Ошибка загрузки отчетов:", e);
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
        const reportDetailsDiv = detailContainer.querySelector('.report-details');
        reportDetailsDiv.style.opacity = '0.5';
        
        const oldContent = reportDetailsDiv.querySelector('#admin-report-content');
        if (oldContent) oldContent.remove();
        const oldRating = reportDetailsDiv.querySelector('.rating-display-container');
        if (oldRating) oldRating.remove();

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
            if (report.status === 'rejected' && report.rejectionComment) {
                rejectionEl.style.display = 'block';
                rejectionEl.innerHTML = `<p><strong>Причина отклонения:</strong> ${report.rejectionComment}</p>`;
            } else if (report.status === 'cancelled' && report.cancellationReason) {
                rejectionEl.style.display = 'block';
                rejectionEl.innerHTML = `<p><strong>Причина отмены агентом:</strong> ${report.cancellationReason}</p>`;
            } else {
                rejectionEl.style.display = 'none';
            }

            const ratingHtml = `<div class="rating-display-container">Итоговый рейтинг: ${getRatingBadgeHtml(report.rating)}</div>`;
            rejectionEl.insertAdjacentHTML('beforebegin', ratingHtml);

            let reportHtml = '<div id="admin-report-content">';
            const answers = report.answers || {};
            const photoUrls = report.photoUrls || {};
            
            const renderQuestion = (label, answerKey) => {
                const answer = answers[answerKey] || '—';
                const color = answer === 'Нет' ? 'style="color: var(--status-rejected);"' : (answer === 'Да' ? 'style="color: var(--status-approved);"' : '');
                return `<div class="form-group"><label>${label}</label><p><strong ${color}>${answer}</strong></p></div>`;
            };
            
            const renderPhotos = (urls, title) => {
                if (!urls || urls.length === 0) return '';
                return `<h4>${title}</h4><div class="photo-gallery">` + urls.map(url => `<a href="${url}" target="_blank"><img src="${url}" alt="фото-отчет"></a>`).join('') + `</div>`;
            };

            reportHtml += '<h3>Чистота и внешний вид павильона</h3>';
            reportHtml += renderQuestion('Территория у павильона чистая', 'q_territory');
            reportHtml += renderQuestion('Стены и вывеска чистые', 'q_walls');
            reportHtml += renderQuestion('Стекла прозрачные', 'q_windows');
            reportHtml += renderQuestion('Меню и рекламные материалы чистые', 'q_menu_ads');
            reportHtml += renderQuestion('Контейнеры для мусора чистые', 'q_trash_bins');
            reportHtml += renderQuestion('Подоконники чистые', 'q_windowsills');
            reportHtml += renderQuestion('Зона приготовления аккуратная', 'q_cook_zone');
            reportHtml += renderQuestion('Холодильник с напитками чистый', 'q_fridge');
            reportHtml += renderQuestion('В зоне видимости нет беспорядка', 'q_guest_zone');
            reportHtml += renderQuestion('Светодиоды и вывеска исправны', 'q_lights');
            
            reportHtml += '<h3>Внешний вид сотрудников</h3>';
            reportHtml += renderQuestion('Сотрудники в фирменной форме', 'q_uniform');
            reportHtml += renderQuestion('Волосы убраны под головной убор', 'q_hair');
            reportHtml += renderQuestion('Ногти соответствуют нормам', 'q_nails');
            reportHtml += renderQuestion('Одежда и обувь чистые', 'q_clothes_clean');
            reportHtml += renderPhotos(photoUrls.location, 'Фото павильона:');
            
            reportHtml += '<h3>Приём и выдача заказа</h3>';
            reportHtml += renderQuestion('Сотрудник поприветствовал', 'q_greeting');
            reportHtml += renderQuestion('Общение вежливое и доброжелательное', 'q_polite');
            reportHtml += renderQuestion('Готовность помочь с выбором', 'q_help');
            reportHtml += renderQuestion('Предложено дополнение к блюду', 'q_addons');
            reportHtml += renderQuestion('Предложены доп. позиции', 'q_upsell');
            reportHtml += renderQuestion('Заказ продублирован, сумма названа', 'q_repeat_order');
            reportHtml += renderQuestion('Выдан номер заказа', 'q_order_number');
            reportHtml += renderQuestion('Озвучено время ожидания', 'q_wait_time_announced');
            reportHtml += renderQuestion('Заказ выдан полностью', 'q_order_complete');
            reportHtml += renderQuestion('Выдан кассовый чек', 'q_receipt_given');
            reportHtml += renderQuestion('Фактическое время ожидания:', 'q_wait_time_actual');
            reportHtml += renderQuestion('Количество салфеток:', 'q_napkins_count');
            reportHtml += renderPhotos(photoUrls.receipt, 'Фото чека:');

            reportHtml += '<h3>Качество блюд</h3>';
            if (answers.dishes && answers.dishes.length > 0) {
                answers.dishes.forEach((dish, index) => {
                    reportHtml += `<div class="dish-evaluation-block"><h4>Блюдо: <strong>${dish.name || 'Без названия'}</strong></h4>`;
                    reportHtml += renderQuestion('Упаковка чистая, не повреждена.', `packaging_${index}`);
                    reportHtml += renderQuestion('Внешний вид аккуратный и аппетитный.', `appearance_${index}`);
                    reportHtml += renderQuestion('Индивидуальные пожелания учтены.', `wishes_${index}`);
                    reportHtml += renderQuestion('Температура соответствует норме.', `temp_${index}`);
                    reportHtml += renderQuestion('Вкус сбалансированный.', `taste_${index}`);
                    reportHtml += renderQuestion('Посторонние привкусы и запахи отсутствуют.', `smell_${index}`);
                    
                    // Корректировка для чтения фото из объекта
                    const dishPhotos = (photoUrls.dishes && photoUrls.dishes[index]) ? photoUrls.dishes[index] : [];
                    reportHtml += renderPhotos(dishPhotos, 'Фото блюда:');
                    reportHtml += '</div>';
                });
            }
            
            reportHtml += '<h3>Общие впечатления</h3>';
            reportHtml += `<div class="form-group"><label>Дополнительные замечания по вкусу:</label><p>${answers.q_final_taste_remarks || '—'}</p></div>`;
            reportHtml += `<div class="form-group"><label>Замечания, жалобы, предложения:</label><p>${answers.q_final_general_remarks || '—'}</p></div>`;

            reportHtml += '</div>';
            rejectionEl.insertAdjacentHTML('afterend', reportHtml);

        } catch (err) {
            console.error("Ошибка загрузки отчета для админа:", err);
            showModal('Ошибка', 'Не удалось загрузить отчет.');
            showScreen('admin-reports-screen');
        } finally {
            reportDetailsDiv.style.opacity = '1';
        }
    }

    document.getElementById('admin-action-approve').addEventListener('click', () => updateReportStatus('approved'));
    document.getElementById('admin-action-paid').addEventListener('click', () => updateReportStatus('paid'));
    document.getElementById('admin-action-reject').addEventListener('click', () => {
        const modal = document.getElementById('rejection-modal-container');
        const confirmBtn = document.getElementById('rejection-modal-confirm-btn');
        const commentInput = document.getElementById('rejection-comment-input');
        commentInput.value = '';
        modal.classList.remove('modal-hidden');
        confirmBtn.onclick = () => {
            if (commentInput.value.trim()) {
                updateReportStatus('rejected', commentInput.value.trim());
                modal.classList.add('modal-hidden');
            } else {
                alert('Укажите причину.');
            }
        };
        document.getElementById('rejection-modal-cancel-btn').onclick = () => modal.classList.add('modal-hidden');
    });

    async function updateReportStatus(status, comment = null) {
        if (!currentReportId) return;
        const updateData = { status };
        if (comment) updateData.rejectionComment = comment;
        try {
            const reportRef = db.collection('reports').doc(currentReportId);
            
            if (status === 'approved') {
                const reportDoc = await reportRef.get();
                const reportData = reportDoc.data();
                if (reportData && reportData.userId && reportData.status !== 'approved') {
                    await db.collection('users').doc(reportData.userId).update({ completedChecks: firebase.firestore.FieldValue.increment(1) });
                }
            }
            
            await reportRef.update(updateData);
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
        const listContainer = document.getElementById('schedule-cards-list');
        const emptyView = document.getElementById('no-schedules-view');
        listContainer.innerHTML = '<div class="spinner"></div>';
        emptyView.style.display = 'none';
        
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const snapshot = await db.collection('schedules')
                .where('isBooked', '==', false)
                .where('date', '>=', today)
                .orderBy('date', 'asc')
                .get();

            if (snapshot.empty) {
                listContainer.innerHTML = '';
                emptyView.style.display = 'block';
                return;
            }

            let html = snapshot.docs.map(doc => {
                const schedule = doc.data();
                const dateStr = schedule.date.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                return `<li class="menu-list-item">
                            <i class="icon fa-solid fa-location-dot"></i>
                            <div style="flex-grow: 1;">
                                <strong>${formatLocationNameForUser(schedule.locationName)} (${schedule.city})</strong>
                                <small>Дата: ${dateStr} | Время: ${schedule.startTime} - ${schedule.endTime} ${schedule.isUrgent ? '🔥' : ''}</small>
                            </div>
                            <button class="btn-book-schedule" data-id="${doc.id}">Записаться</button>
                        </li>`;
            }).join('');
            
            listContainer.innerHTML = html;
            
            listContainer.querySelectorAll('.btn-book-schedule').forEach(button => {
                button.addEventListener('click', (e) => {
                    const scheduleId = e.target.dataset.id;
                    confirmAndBookSchedule(scheduleId);
                });
            });

        } catch (error) {
            console.error("Ошибка загрузки доступных проверок:", error);
            listContainer.innerHTML = '<div class="empty-state"><p>Не удалось загрузить проверки. Попробуйте обновить страницу.</p></div>';
        }
    }

    async function confirmAndBookSchedule(scheduleId) {
        showModal('Подтверждение', 'Вы уверены, что хотите записаться на эту проверку?', 'confirm', async (confirmed) => {
            if (!confirmed) return;
            const user = appState.user;
            if (!user) return showModal('Ошибка', 'Ваша сессия истекла, пожалуйста, войдите заново.');
            document.getElementById('loader').classList.add('active');
            try {
                const scheduleRef = db.collection('schedules').doc(scheduleId);
                await db.runTransaction(async (transaction) => {
                    const scheduleDoc = await transaction.get(scheduleRef);
                    if (!scheduleDoc.exists) throw new Error("Эта проверка больше не доступна.");
                    if (scheduleDoc.data().isBooked) throw new Error("Другой агент уже записался на эту проверку.");
                    transaction.update(scheduleRef, { isBooked: true });
                    const newReportRef = db.collection('reports').doc();
                    transaction.set(newReportRef, {
                        userId: user.uid, scheduleId,
                        locationName: scheduleDoc.data().locationName,
                        city: scheduleDoc.data().city,
                        checkDate: scheduleDoc.data().date,
                        status: 'booked',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });
                
                await loadUserDashboard(user.uid);
                showScreen('main-menu-screen');
                showModal('Успешно!', 'Вы записаны на проверку. Задание появилось на вашем главном экране.');

            } catch (error) {
                showModal('Ошибка', error.message);
                renderAvailableSchedules();
            } finally {
                document.getElementById('loader').classList.remove('active');
            }
        });
    }
    
    async function loadUserDashboard(userId) {
        const container = document.getElementById('dashboard-info-container');
        container.innerHTML = '<div class="spinner"></div>';
        try {
            const snapshot = await db.collection('reports')
                .where('userId', '==', userId)
                .where('status', '==', 'booked')
                .orderBy('checkDate', 'asc')
                .get();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const activeChecks = snapshot.docs.filter(doc => {
                const checkDate = doc.data().checkDate.toDate();
                return checkDate >= today;
            });

            if (activeChecks.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>У вас нет активных проверок. Вы можете записаться на новую проверку.</p></div>';
                return;
            }
            
            let html = '<h4>Ваши активные задания:</h4><ul class="menu-list">';
            html += activeChecks.map(doc => {
                const report = doc.data();
                const ratingBadge = getRatingBadgeHtml(report.rating); 
                const dateStr = report.checkDate.toDate().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                return `<li class="menu-list-item">
                            <div class="status-indicator booked"></div>
                            <div style="flex-grow: 1;">
                                <strong>${formatLocationNameForUser(report.locationName)} ${ratingBadge}</strong>
                                <small>Дата проверки: ${dateStr}</small>
                                <div class="task-actions">
                                    <button class="btn-fill-checklist" data-id="${doc.id}">Заполнить чек-лист</button>
                                    <button class="btn-cancel-booking" data-id="${doc.id}">Отменить</button>
                                </div>
                            </div>
                        </li>`;
            }).join('');
            html += '</ul>';
            container.innerHTML = html;
            
            container.querySelectorAll('.btn-fill-checklist').forEach(btn => btn.addEventListener('click', e => openChecklist(e.target.dataset.id)));
            container.querySelectorAll('.btn-cancel-booking').forEach(btn => btn.addEventListener('click', e => cancelBooking(e.target.dataset.id)));
        } catch (error) {
            console.error("ОШИБКА ЗАГРУЗКИ ДАШБОРДА:", error);
            container.innerHTML = `<div class="empty-state">
                <p style="color: var(--status-rejected);">Не удалось загрузить ваши задания.</p>
                <small>Это может быть связано с отсутствием необходимого индекса в базе данных Firebase. Проверьте консоль разработчика (F12) для получения подробной ссылки на его создание.</small>
            </div>`;
        }
    }

    function cancelBooking(id) {
        const modal = document.getElementById('cancellation-modal-container');
        const confirmBtn = document.getElementById('cancellation-modal-confirm-btn');
        const cancelBtn = document.getElementById('cancellation-modal-cancel-btn');
        const commentInput = document.getElementById('cancellation-comment-input');
        commentInput.value = '';
        modal.classList.remove('modal-hidden');

        confirmBtn.onclick = async () => {
            const reason = commentInput.value.trim();
            if (!reason) return alert('Пожалуйста, укажите причину отмены.');
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<div class="spinner-small"></div>';
            try {
                const user = appState.user;
                if (!user) throw new Error("Пользователь не найден");

                const reportRef = db.collection('reports').doc(id);
                const reportDoc = await reportRef.get();
                if (!reportDoc.exists) throw new Error("Отчет не найден.");

                const scheduleId = reportDoc.data().scheduleId;
                const batch = db.batch();

                batch.update(reportRef, {
                    status: 'cancelled',
                    cancellationReason: reason,
                    cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (scheduleId) {
                    batch.update(db.collection('schedules').doc(scheduleId), { isBooked: false });
                }

                await batch.commit();
                showModal('Успешно', 'Запись отменена.');
                loadUserDashboard(user.uid);
            } catch (e) {
                showModal('Ошибка', 'Не удалось отменить запись. ' + e.message);
            } finally {
                modal.classList.add('modal-hidden');
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Отправить';
            }
        };
        cancelBtn.onclick = () => modal.classList.add('modal-hidden');
    }

    async function prepareChecklistForm(report) {
        document.getElementById('checklist-address').textContent = formatLocationNameForUser(report.locationName);
        document.getElementById('checklist-date').textContent = report.checkDate.toDate().toLocaleDateString('ru-RU');
        
        const form = document.getElementById('checklist-form');
        form.reset();
        
        const dishContainer = document.getElementById('dish-evaluation-container');
        dishContainer.innerHTML = '';

        const addDishBtn = document.getElementById('add-dish-btn');
        const dishTemplate = document.getElementById('dish-evaluation-template');

        addDishBtn.onclick = () => {
            const dishClone = dishTemplate.content.cloneNode(true);
            const dishCount = dishContainer.children.length;
            
            dishClone.querySelectorAll('input[type="radio"]').forEach(radio => {
                const property = radio.dataset.property;
                radio.name = `${property}_${dishCount}`;
            });

            const nameLabel = dishClone.querySelector('label[for="dish_name_template"]');
            const nameInput = dishClone.querySelector('#dish_name_template');
            if(nameLabel && nameInput) {
                const newId = `dish_name_${dishCount}`;
                nameInput.id = newId;
                nameLabel.setAttribute('for', newId);
            }

            const photoLabel = dishClone.querySelector('label[for="dish_photos_template"]');
            const photoInput = dishClone.querySelector('#dish_photos_template');
            if(photoLabel && photoInput) {
                const newId = `dish_photos_${dishCount}`;
                photoInput.id = newId;
                photoLabel.setAttribute('for', newId);
            }

            dishContainer.appendChild(dishClone);
        };
        
        dishContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-dish-btn')) {
                e.target.closest('.dish-evaluation-block').remove();
            }
        });

        return { form, dishContainer, addDishBtn };
    }

    async function openChecklist(id) {
        try {
            const doc = await db.collection('reports').doc(id).get();
            if (!doc.exists) return showModal('Ошибка', 'Задание не найдено.');
            currentReportId = id;
            const report = doc.data();

            const { addDishBtn } = await prepareChecklistForm(report);
            addDishBtn.click();

            showScreen('checklist-screen');
        } catch (error) {
            showModal('Ошибка', 'Не удалось загрузить чек-лист.');
        }
    }
    
    async function openChecklistForEdit(id) {
        try {
            const doc = await db.collection('reports').doc(id).get();
            if (!doc.exists) return showModal('Ошибка', 'Задание для редактирования не найдено.');
            
            currentReportId = id;
            const report = doc.data();
            const answers = report.answers || {};

            const { form, dishContainer, addDishBtn } = await prepareChecklistForm(report);

            for (const key in answers) {
                if (key === 'dishes') continue;
                const value = answers[key];
                const input = form.querySelector(`[name="${key}"]`);
                if (input) {
                    if (input.type === 'radio') {
                        const radioToSelect = form.querySelector(`input[name="${key}"][value="${value}"]`);
                        if (radioToSelect) radioToSelect.checked = true;
                    } else {
                        input.value = value;
                    }
                }
            }
            
            (answers.dishes || []).forEach((dishData, index) => {
                addDishBtn.click();
                const newDishBlock = dishContainer.lastElementChild;
                if (newDishBlock) {
                    for (const property in dishData) {
                        const value = dishData[property];
                        const propInput = newDishBlock.querySelector(`[data-property="${property}"]`);
                        if (propInput) {
                            if (propInput.type === 'radio') {
                                const radioName = `${property}_${index}`;
                                const radioToSelect = newDishBlock.querySelector(`input[name="${radioName}"][value="${value}"]`);
                                if (radioToSelect) radioToSelect.checked = true;
                            } else {
                                propInput.value = value;
                            }
                        }
                    }
                }
            });

            if (!answers.dishes || answers.dishes.length === 0) {
                 addDishBtn.click();
            }

            showScreen('checklist-screen');
        } catch (error) {
            console.error("Ошибка при открытии чек-листа для редактирования:", error);
            showModal('Ошибка', 'Не удалось загрузить данные для редактирования.');
        }
    }

    // =================================================================
    // ИСПРАВЛЕНИЕ №2: Не отправляется отчет
    // =================================================================
    document.getElementById('checklist-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = appState.user;
        if (!user || !currentReportId) return;

        const form = e.currentTarget;
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-small"></div>';

        try {
            const reportRef = db.collection('reports').doc(currentReportId);
            const reportDoc = await reportRef.get();
            const existingData = reportDoc.data();
            
            // Инициализируем photoUrls с dishes как ОБЪЕКТ
            const existingPhotoUrls = existingData.photoUrls || { location: [], receipt: [], dishes: {} };

            const answers = {};
            const photoUploads = {};
            
            form.querySelectorAll('input:not([type="file"]), textarea').forEach(input => {
                if(input.type === 'radio' && !input.checked) return;
                if(input.closest('.dish-evaluation-block')) return;
                const name = input.name || input.id;
                if(name) answers[name] = input.value;
            });

            const dishes = [];
            form.querySelectorAll('#dish-evaluation-container .dish-evaluation-block').forEach((dishBlock, index) => {
                const dishData = {};
                const nameInput = dishBlock.querySelector('[data-property="name"]');
                if(!nameInput || !nameInput.value.trim()) return;

                dishData.name = nameInput.value.trim();
                dishBlock.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
                    dishData[radio.dataset.property] = radio.value;
                });
                dishes.push(dishData);
                
                const dishPhotosInput = dishBlock.querySelector('.dish-photos');
                if (dishPhotosInput && dishPhotosInput.files.length > 0) {
                    photoUploads[`dish_${index}`] = Array.from(dishPhotosInput.files);
                }
            });
            answers.dishes = dishes;

            if (form.querySelector('#photos_location').files.length > 0) photoUploads.location = Array.from(form.querySelector('#photos_location').files);
            if (form.querySelector('#photos_receipt').files.length > 0) photoUploads.receipt = Array.from(form.querySelector('#photos_receipt').files);

            let totalQuestions = 0;
            let yesAnswers = 0;
            form.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
                if (radio.value === 'Да') {
                    yesAnswers++;
                    totalQuestions++;
                } else if (radio.value === 'Нет') {
                    totalQuestions++;
                }
            });
            const rating = totalQuestions > 0 ? Math.round((yesAnswers / totalQuestions) * 100) : 0;
            
            const photoUrls = JSON.parse(JSON.stringify(existingPhotoUrls));
            const uploadPromises = [];
            for (const category in photoUploads) {
                for (const file of photoUploads[category]) {
                    const filePath = `reports/${currentReportId}/${category}/${Date.now()}_${file.name}`;
                    const uploadTask = storage.ref(filePath).put(file)
                        .then(snapshot => snapshot.ref.getDownloadURL())
                        .then(url => {
                            if (category.startsWith('dish_')) {
                                const dishIndex = category.split('_')[1]; // Ключ будет "0", "1" и т.д.
                                // Инициализируем массив для этого ключа, если его нет
                                if (!photoUrls.dishes[dishIndex]) {
                                    photoUrls.dishes[dishIndex] = [];
                                }
                                photoUrls.dishes[dishIndex].push(url);
                            } else {
                                photoUrls[category] = [url];
                            }
                        });
                    uploadPromises.push(uploadTask);
                }
            }
            await Promise.all(uploadPromises);

            const updateData = {
                answers, rating, photoUrls,
                status: 'pending',
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectionComment: firebase.firestore.FieldValue.delete()
            };

            await reportRef.update(updateData);
            
            showModal('Отправлен на проверку!', 'Спасибо! Мы свяжемся с вами после проверки отчета.', 'alert', () => {
                showScreen('main-menu-screen');
                loadUserDashboard(user.uid);
            });

        } catch (err) {
            console.error("Ошибка при отправке отчета:", err);
            showModal('Ошибка', err.message || 'Не удалось отправить отчет. Проверьте все поля и попробуйте снова.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Отправить отчет';
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
            let html = snapshot.docs.map(doc => {
                const r = doc.data();
                const statusMap = { pending: 'на проверке', approved: 'принят', rejected: 'отклонен', paid: 'оплачен' };
                const comment = (r.status === 'rejected' && r.rejectionComment) ? `<small style="color:var(--status-rejected); display:block; margin-top:5px;"><b>Причина:</b> ${r.rejectionComment}</small>` : '';
                const editButton = (r.status === 'rejected') ? `<div class="task-actions"><button class="btn-edit-report" data-id="${doc.id}">Редактировать</button></div>` : '';
                const ratingBadge = getRatingBadgeHtml(r.rating);

                return `<li class="menu-list-item">
                            <div class="status-indicator ${r.status}"></div>
                            <div style="flex-grow: 1;">
                                <strong>${formatLocationNameForUser(r.locationName)} ${ratingBadge}</strong>
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
                <div class="form-group"><label>Вопрос</label><input type="text" class="ci-item-question" value="${item.question || ''}" required></div>
                <div class="form-group"><label>Пример ответа</label><textarea class="ci-item-answer" rows="3" required>${item.answer || ''}</textarea></div>
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
        container.insertAdjacentHTML('beforeend', createInstructionItemForm({}, instructionItemCounter++));
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
