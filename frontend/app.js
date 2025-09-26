// ... (начало файла с конфигурацией Firebase и аутентификацией остается без изменений) ...

document.addEventListener('DOMContentLoaded', () => {
    // ... (все DOM-элементы и логика до setupAdminUI остаются без изменений) ...

    // --- НОВЫЕ DOM ЭЛЕМЕНТЫ ДЛЯ ЭТАПА 3 ---
    const scheduleCardsList = document.getElementById('schedule-cards-list');
    const noSchedulesView = document.getElementById('no-schedules-view');
    const lottieAnimationContainer = document.getElementById('lottie-animation');
    const slotsList = document.getElementById('slots-list');
    const slotLocationTitle = document.getElementById('slot-location-title');

    // Запускаем анимацию один раз
    if(lottieAnimationContainer) {
        lottie.loadAnimation({
            container: lottieAnimationContainer,
            renderer: 'svg',
            loop: false,
            autoplay: true,
            path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' // Ссылка на анимацию
        });
    }

    // --- ЛОГИКА ЭТАПА 3: ЗАПИСЬ НА ПРОВЕРКУ ---
    
    // 1. Главная функция для отображения доступных проверок
    async function renderAvailableSchedules() {
        if (!scheduleCardsList || !noSchedulesView) return;
        showScreen('cooperation-screen');
        scheduleCardsList.innerHTML = '<div class="spinner"></div>';
        noSchedulesView.style.display = 'none';

        try {
            const now = new Date();
            const snapshot = await db.collection('schedule').where('date', '>=', now).get();
            
            const schedules = [];
            snapshot.forEach(doc => {
                schedules.push({ id: doc.id, ...doc.data() });
            });

            // Сортировка: сначала горящие, потом по дате
            schedules.sort((a, b) => {
                if (a.isUrgent && !b.isUrgent) return -1;
                if (!a.isUrgent && b.isUrgent) return 1;
                return a.date.toMillis() - b.date.toMillis();
            });

            if (schedules.length === 0) {
                scheduleCardsList.innerHTML = '';
                noSchedulesView.style.display = 'block';
                return;
            }

            let cardsHTML = '';
            for (const schedule of schedules) {
                const date = schedule.date.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
                const urgentClass = schedule.isUrgent ? 'urgent' : '';
                cardsHTML += `
                    <li class="menu-list-item schedule-card ${urgentClass}" data-schedule-id="${schedule.id}" data-location-title="${schedule.locationName} (${date})">
                        ${schedule.isUrgent ? '<i class="icon fa-solid fa-fire"></i>' : '<i class="icon fa-solid fa-calendar-day"></i>'}
                        <div>
                            <strong>${schedule.locationName}</strong>
                            <small>${schedule.locationAddress} - <b>${date}</b></small>
                        </div>
                    </li>
                `;
            }
            scheduleCardsList.innerHTML = cardsHTML;

            // Добавляем обработчики кликов на новые карточки
            document.querySelectorAll('.schedule-card').forEach(card => {
                card.addEventListener('click', () => {
                    const scheduleId = card.dataset.scheduleId;
                    const locationTitle = card.dataset.locationTitle;
                    renderTimeSlots(scheduleId, locationTitle);
                });
            });

        } catch (error) {
            console.error("Ошибка загрузки доступных проверок:", error);
            scheduleCardsList.innerHTML = '';
            noSchedulesView.style.display = 'block'; // Показываем пустышку и при ошибке
        }
    }

    // 2. Функция для отображения временных слотов для выбранной проверки
    async function renderTimeSlots(scheduleId, locationTitle) {
        if (!slotsList || !slotLocationTitle) return;
        showScreen('time-slots-screen');
        slotLocationTitle.textContent = locationTitle;
        slotsList.innerHTML = '<div class="spinner"></div>';

        try {
            const snapshot = await db.collection('timeSlots')
                .where('scheduleId', '==', scheduleId)
                .where('status', '==', 'свободен')
                .get();

            if (snapshot.empty) {
                slotsList.innerHTML = '<p>К сожалению, все свободные места на эту дату уже заняты.</p>';
                return;
            }

            let slotsHTML = '';
            snapshot.forEach(doc => {
                const slot = doc.data();
                slotsHTML += `
                    <li class="menu-list-item time-slot" data-slot-id="${doc.id}">
                        <i class="icon fa-solid fa-clock"></i>
                        <div><strong>${slot.startTime} - ${slot.endTime}</strong></div>
                    </li>
                `;
            });
            slotsList.innerHTML = slotsHTML;

            // Добавляем обработчики кликов на слоты
            document.querySelectorAll('.time-slot').forEach(slot => {
                slot.addEventListener('click', async () => {
                    const slotId = slot.dataset.slotId;
                    const user = auth.currentUser;
                    if (!user) return alert('Ошибка: вы не авторизованы.');

                    const confirmBooking = confirm('Вы уверены, что хотите записаться на это время?');
                    if (confirmBooking) {
                        try {
                            const userDoc = await db.collection('users').doc(user.uid).get();
                            const agentName = userDoc.data().fullName;

                            await db.collection('timeSlots').doc(slotId).update({
                                status: 'забронирован',
                                bookedBy: user.uid,
                                agentName: agentName
                            });
                            alert('Вы успешно записаны на проверку! Информация появится на главном экране.');
                            showScreen('main-menu-screen');
                        } catch (error) {
                            console.error("Ошибка записи на слот:", error);
                            alert('Не удалось записаться. Возможно, кто-то только что занял это время. Попробуйте снова.');
                            renderTimeSlots(scheduleId, locationTitle); // Обновляем список
                        }
                    }
                });
            });

        } catch (error) {
            console.error("Ошибка загрузки слотов:", error);
            slotsList.innerHTML = '<p>Не удалось загрузить временные слоты.</p>';
        }
    }

    // --- ОБНОВЛЕНИЕ СТАРЫХ ОБРАБОТЧИКОВ ---
    
    // Обновляем обработчик для кнопки "Записаться на проверку"
    const cooperationBtn = document.querySelector('[data-target="cooperation-screen"]');
    if(cooperationBtn) {
        cooperationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            renderAvailableSchedules(); // <--- Теперь она запускает нашу новую функцию
        });
    }

    // ... (весь остальной код остается без изменений) ...
});
