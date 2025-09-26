// ... (весь предыдущий код конфигурации и инициализации Firebase остается без изменений)

document.addEventListener('DOMContentLoaded', () => {

    // ... (все переменные для элементов DOM остаются без изменений)
    // ДОБАВЛЯЕМ НОВЫЕ ПЕРЕМЕННЫЕ
    const adminMenuContainer = document.getElementById('admin-menu-container');
    const adminReportsList = document.getElementById('admin-reports-list');
    let currentUserRole = 'guest'; // Роль по умолчанию

    // ... (вся логика авторизации и навигации остается без изменений)

    // =================================================================
    // ОБНОВЛЕННЫЙ КОНТРОЛЛЕР ПРОВЕРКИ СТАТУСА
    // =================================================================
    auth.onAuthStateChanged(user => {
        if (user) {
            // Пользователь вошел, теперь нужно узнать его роль
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    currentUserRole = doc.data().role;
                }
                // Показываем главный экран и кнопки
                showScreen('main-menu-screen');
                renderCityButtons();
                setupAdminButton(); // <-- НОВАЯ ФУНКЦИЯ
            });
        } else {
            currentUserRole = 'guest'; // Сбрасываем роль при выходе
            showScreen('auth-screen');
            setupAdminButton(); // Прячем кнопку админа
        }
    });

    // =================================================================
    // НОВЫЙ КОД: ФУНКЦИИ АДМИН-ПАНЕЛИ
    // =================================================================
    
    // Функция, которая решает, показывать ли кнопку "Админка"
    function setupAdminButton() {
        adminMenuContainer.innerHTML = ''; // Очищаем контейнер
        if (currentUserRole === 'admin') {
            const adminButton = document.createElement('button');
            adminButton.className = 'menu-btn';
            adminButton.textContent = 'Админ-панель';
            adminButton.addEventListener('click', () => {
                renderAllReports();
                showScreen('admin-screen');
            });
            adminMenuContainer.appendChild(adminButton);
        }
    }

    // Функция для загрузки и отображения ВСЕХ отчетов
    function renderAllReports() {
        if (!adminReportsList) return;
        adminReportsList.innerHTML = '<div class="spinner"></div>';

        db.collection('reports').orderBy('checkDate', 'desc').get()
            .then(snapshot => {
                adminReportsList.innerHTML = '';
                if (snapshot.empty) {
                    adminReportsList.innerHTML = '<p>Пока нет ни одного отчета.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    const report = doc.data();
                    const date = report.checkDate.toDate().toLocaleString('ru-RU');
                    const statusText = report.status === 'pending' ? 'в ожидании' : report.status;
                    
                    const li = document.createElement('li');
                    li.className = 'location-item';
                    // Добавляем email пользователя, чтобы знать, кто отправил
                    li.innerHTML = `
                        <strong>${report.pointAddress}</strong>
                        <small>Пользователь: ${report.userEmail}</small>
                        <small>Дата: ${date} - Статус: ${statusText}</small>
                    `;
                    // TODO: Добавить клик для просмотра деталей отчета
                    adminReportsList.appendChild(li);
                });
            })
            .catch(error => {
                console.error("Ошибка при загрузке всех отчетов: ", error);
                adminReportsList.innerHTML = '<p>Не удалось загрузить отчеты.</p>';
            });
    }

    // ... (вся остальная логика остается без изменений)
});
