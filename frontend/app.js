// ... (начало файла с конфигурацией Firebase остается без изменений) ...

document.addEventListener('DOMContentLoaded', () => {
    // ... (DOM элементы для аутентификации остаются без изменений) ...

    // --- НОВЫЕ DOM ЭЛЕМЕНТЫ ДЛЯ АДМИН-ПАНЕЛИ ---
    const adminMenuContainer = document.getElementById('admin-menu-container');
    const scheduleForm = document.getElementById('schedule-form');
    const scheduleLocationSelect = document.getElementById('schedule-location-select');
    const scheduleDateInput = document.getElementById('schedule-date-input');
    const timeSlotsContainer = document.getElementById('time-slots-container');
    const addSlotBtn = document.getElementById('add-slot-btn');
    const scheduleUrgentCheckbox = document.getElementById('schedule-urgent-checkbox');
    const scheduleList = document.getElementById('schedule-list');

    let currentUserRole = 'guest'; // Глобальная переменная для роли пользователя

    // ... (весь код для аутентификации по телефону остается без изменений) ...

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЯ ---
    auth.onAuthStateChanged(user => {
        if (user) {
            const userRef = db.collection('users').doc(user.uid);
            userRef.get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    currentUserRole = userData.role || 'guest';
                    userNameDisplay.textContent = userData.fullName;
                    setupAdminUI(); // <--- НОВАЯ ФУНКЦИЯ
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            });
        } else {
            currentUserRole = 'guest';
            setupAdminUI();
            // ... (остальная логика для выхода) ...
        }
    });

    // --- ЛОГИКА АДМИН-ПАНЕЛИ ---

    // 1. Показываем кнопку админки, если у пользователя роль 'admin'
    function setupAdminUI() {
        adminMenuContainer.innerHTML = '';
        if (currentUserRole === 'admin') {
            const adminButton = document.createElement('li');
            adminButton.className = 'menu-list-item menu-btn';
            adminButton.dataset.target = 'admin-schedule-screen';
            adminButton.innerHTML = `
                <i class="icon fa-solid fa-user-shield"></i>
                <div><strong>Панель Администратора</strong><small>Управление графиком проверок</small></div>
            `;
            adminButton.addEventListener('click', () => {
                loadLocationsForAdmin();
                renderSchedules();
                showScreen('admin-schedule-screen');
            });
            adminMenuContainer.appendChild(adminButton);
        }
    }

    // 2. Загружаем список локаций в форму
    async function loadLocationsForAdmin() {
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

    // 3. Добавляем поля для временных слотов
    let slotCounter = 0;
    function addSlotInput() {
        slotCounter++;
        const slotDiv = document.createElement('div');
        slotDiv.className = 'time-slot-input';
        slotDiv.innerHTML = `
            <input type="time" class="slot-start" required> - 
            <input type="time" class="slot-end" required>
            <button type="button" class="remove-slot-btn">×</button>
        `;
        timeSlotsContainer.appendChild(slotDiv);
        slotDiv.querySelector('.remove-slot-btn').addEventListener('click', () => {
            slotDiv.remove();
        });
    }
    addSlotBtn.addEventListener('click', addSlotInput);
    addSlotInput(); // Добавляем первый слот по умолчанию

    // 4. Обработчик отправки формы создания графика
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
            if (start && end) {
                timeSlots.push({ startTime: start, endTime: end });
            }
        });

        if (!locationId || !date || timeSlots.length === 0) {
            alert('Заполните все поля и добавьте хотя бы один временной слот.');
            return;
        }

        try {
            // Создаем основную запись о проверке
            const scheduleDocRef = await db.collection('schedule').add({
                locationId,
                locationName,
                locationAddress,
                date: new Date(date),
                isUrgent
            });
            
            // Для каждого слота создаем отдельный документ
            const batch = db.batch();
            timeSlots.forEach(slot => {
                const slotDocRef = db.collection('timeSlots').doc();
                batch.set(slotDocRef, {
                    scheduleId: scheduleDocRef.id,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    status: 'свободен',
                    bookedBy: null,
                    agentName: null
                });
            });
            await batch.commit();

            alert('Проверка успешно добавлена в график!');
            scheduleForm.reset();
            timeSlotsContainer.innerHTML = '';
            addSlotInput();
            renderSchedules(); // Обновляем список
        } catch (error) {
            console.error("Ошибка сохранения графика:", error);
            alert('Не удалось сохранить проверку.');
        }
    });

    // 5. Отображение списка запланированных проверок
    async function renderSchedules() {
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
                listHTML += `
                    <div class="schedule-item ${urgentClass}">
                        <strong>${schedule.locationName}</strong>
                        <small>${date} ${schedule.isUrgent ? '🔥' : ''}</small>
                    </div>
                `;
            });
            scheduleList.innerHTML = listHTML;
        } catch (error) {
            console.error("Ошибка загрузки графика:", error);
            scheduleList.innerHTML = '<p>Не удалось загрузить список проверок.</p>';
        }
    }
    
    // ... (остальная часть файла с навигацией и выходом из системы) ...
});
