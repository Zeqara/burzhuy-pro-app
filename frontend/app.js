// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let confirmationResult = null;
let currentCheckData = null; // Для хранения данных текущей проверки

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: НАВИГАЦИЯ
// =================================================================
function showScreen(screenId) { /* ... без изменений ... */ }

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ВСЕГО ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // DOM Элементы
    // ... (все старые DOM элементы) ...
    const dashboardInfoContainer = document.getElementById('dashboard-info-container');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');

    // ... (весь код для аутентификации, админки и записи на проверки остается без изменений) ...

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    // ... (остальная логика) ...
                    loadUserDashboard(user.uid); // <--- ЗАПУСКАЕМ ЛОГИКУ ДАШБОРДА
                } else { /* ... */ }
            });
        } else { /* ... */ }
    });

    // --- ЛОГИКА ЭТАПА 4: УМНЫЙ ДАШБОРД И ЧЕК-ЛИСТ ---

    let dashboardUpdateInterval = null; // Переменная для таймера
    async function loadUserDashboard(userId) {
        if (!dashboardInfoContainer) return;
        
        // Очищаем предыдущий таймер, если он был
        if (dashboardUpdateInterval) clearInterval(dashboardUpdateInterval);

        const snapshot = await db.collection('timeSlots')
            .where('bookedBy', '==', userId)
            .where('status', '==', 'забронирован')
            .limit(1)
            .get();

        if (snapshot.empty) {
            dashboardInfoContainer.innerHTML = ''; // Если проверок нет, очищаем дашборд
            return;
        }

        const doc = snapshot.docs[0];
        const booking = { id: doc.id, ...doc.data() };
        const scheduleDoc = await db.collection('schedule').doc(booking.scheduleId).get();
        const schedule = scheduleDoc.data();
        currentCheckData = { ...booking, ...schedule }; // Сохраняем все данные о проверке

        const checkDate = schedule.date.toDate();
        const [startHour, startMinute] = booking.startTime.split(':');
        const [endHour, endMinute] = booking.endTime.split(':');
        
        const startTime = new Date(checkDate);
        startTime.setHours(startHour, startMinute, 0, 0);

        const endTime = new Date(checkDate);
        endTime.setHours(endHour, endMinute, 0, 0);

        // Функция, которая будет обновлять карточку и кнопку
        function updateDashboard() {
            const now = new Date();
            let buttonHTML;

            if (now >= startTime && now <= endTime) {
                // Время проверки настало
                buttonHTML = `<button id="start-check-btn" class="btn-primary">Начать проверку</button>`;
            } else if (now < startTime) {
                // Проверка еще не началась
                const diff = startTime - now;
                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                buttonHTML = `<button class="btn-primary" disabled>Начнется через ${hours} ч ${minutes} мин</button>`;
            } else {
                // Время проверки вышло
                buttonHTML = `<button class="btn-primary" disabled>Время проверки истекло</button>`;
            }

            dashboardInfoContainer.innerHTML = `
                <div class="next-check-card">
                    <small>Ваша следующая проверка:</small>
                    <strong>${schedule.locationName}</strong>
                    <p><i class="fa-solid fa-calendar-day"></i> ${checkDate.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})}</p>
                    <p><i class="fa-solid fa-clock"></i> ${booking.startTime} - ${booking.endTime}</p>
                    ${buttonHTML}
                </div>
            `;

            const startCheckBtn = document.getElementById('start-check-btn');
            if (startCheckBtn) {
                startCheckBtn.addEventListener('click', openChecklist);
            }
        }

        updateDashboard(); // Первый запуск
        dashboardUpdateInterval = setInterval(updateDashboard, 60000); // Обновляем каждую минуту
    }

    // Функция для открытия чек-листа с нужными данными
    function openChecklist() {
        if (!currentCheckData) return;
        checklistAddress.textContent = currentCheckData.locationAddress;
        checklistDate.textContent = new Date().toLocaleString('ru-RU');
        checklistForm.reset();
        showScreen('checklist-screen');
    }

    // Обновляем логику отправки чек-листа
    if(checklistForm) checklistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !currentCheckData) return alert('Ошибка: нет данных о проверке.');

        // ... (логика загрузки фото остается без изменений) ...
        const imageUrls = []; // Заглушка для фото

        const reportData = {
            userId: user.uid,
            slotId: currentCheckData.id, // <--- СВЯЗЫВАЕМ ОТЧЕТ СО СЛОТОМ
            checkDate: new Date(),
            status: 'pending', // Теперь все отчеты сначала на проверке у админа
            imageUrls: imageUrls,
            answers: { /* ... все ответы ... */ }
        };

        try {
            await db.collection('reports').add(reportData);
            // После отправки отчета, меняем статус слота на "завершен"
            await db.collection('timeSlots').doc(currentCheckData.id).update({
                status: 'завершен'
            });

            alert('Спасибо за ваш отчёт ✅');
            currentCheckData = null; // Сбрасываем данные
            loadUserDashboard(user.uid); // Обновляем дашборд
            showScreen('main-menu-screen');
        } catch (error) {
            console.error("Ошибка отправки отчета: ", error);
            alert('Не удалось отправить отчет.');
        }
    });
});
