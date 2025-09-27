// =================================================================
// КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// =================================================================
const firebaseConfig = { apiKey: "AIzaSyB0FqDYXnDGRnXVXjkiKbaNNePDvgDXAWc", authDomain: "burzhuy-pro-v2.firebaseapp.com", projectId: "burzhuy-pro-v2", storageBucket: "burzhuy-pro-v2.appspot.com", messagingSenderId: "627105413900", appId: "1:627105413900:web:3a02e926867ff76e256729" };
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
let confirmationResult = null;
let currentCheckData = null;

// =================================================================
// ГЛАВНАЯ ФУНКЦИЯ: НАВИГАЦИЯ
// =================================================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
}

// =================================================================
// ИНИЦИАЛИЗАЦИЯ ВСЕГО ПРИЛОЖЕНИЯ
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // DOM Элементы
    const phoneForm = document.getElementById('phone-form'), codeForm = document.getElementById('code-form'), profileSetupForm = document.getElementById('profile-setup-form');
    const phoneInput = document.getElementById('phone-input'), codeInput = document.getElementById('code-input'), profileNameInput = document.getElementById('profile-name-input');
    const sendCodeBtn = document.getElementById('send-code-btn');
    const phoneView = document.getElementById('phone-view'), codeView = document.getElementById('code-view');
    const userNameDisplay = document.getElementById('user-name-display'), logoutBtn = document.getElementById('logout-btn');
    const adminMenuBtn = document.getElementById('admin-menu-btn');
    const scheduleForm = document.getElementById('schedule-form'), scheduleLocationSelect = document.getElementById('schedule-location-select'), scheduleDateInput = document.getElementById('schedule-date-input'), timeSlotsContainer = document.getElementById('time-slots-container'), addSlotBtn = document.getElementById('add-slot-btn'), scheduleUrgentCheckbox = document.getElementById('schedule-urgent-checkbox'), scheduleList = document.getElementById('schedule-list');
    const scheduleCardsList = document.getElementById('schedule-cards-list'), noSchedulesView = document.getElementById('no-schedules-view'), lottieAnimationContainer = document.getElementById('lottie-animation'), slotsList = document.getElementById('slots-list'), slotLocationTitle = document.getElementById('slot-location-title');
    const dashboardInfoContainer = document.getElementById('dashboard-info-container');
    const checklistForm = document.getElementById('checklist-form'), checklistAddress = document.getElementById('checklist-address'), checklistDate = document.getElementById('checklist-date');
    const historyBtn = document.getElementById('history-btn'), historyList = document.getElementById('history-list');

    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });

    if(lottieAnimationContainer) {
        lottie.loadAnimation({ container: lottieAnimationContainer, renderer: 'svg', loop: false, autoplay: true, path: 'https://assets10.lottiefiles.com/packages/lf20_u4j3xm6g.json' });
    }

    // --- АУТЕНТИФИКАЦИЯ ---
    // ... (Этот блок без изменений) ...

    // --- ГЛАВНЫЙ КОНТРОЛЛЕР ---
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    userNameDisplay.textContent = userData.fullName;
                    if (adminMenuBtn) {
                        adminMenuBtn.style.display = (userData.role === 'admin') ? 'flex' : 'none';
                    }
                    loadUserDashboard(user.uid);
                    showScreen('main-menu-screen');
                } else {
                    showScreen('profile-setup-screen');
                }
            });
        } else {
            if(adminMenuBtn) adminMenuBtn.style.display = 'none';
            if(phoneView && codeView) { phoneView.style.display = 'block'; codeView.style.display = 'none'; }
            showScreen('auth-screen');
        }
    });
    
    // ... (Блоки logout, админ-панели, записи на проверку без изменений) ...

    // ИСПРАВЛЕНИЕ: Добавляем логику для истории
    if (checklistForm) checklistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !currentCheckData) return;
        
        // ... (логика загрузки фото) ...
        const imageUrls = [];

        const reportData = {
            userId: user.uid,
            slotId: currentCheckData.id,
            checkDate: new Date(),
            status: 'pending',
            locationName: currentCheckData.locationName, // <-- ДОБАВЛЕНО
            locationAddress: currentCheckData.locationAddress, // <-- ДОБАВЛЕНО
            imageUrls,
            answers: { /* ... все ответы ... */ }
        };
        
        await db.collection('reports').add(reportData);
        await db.collection('timeSlots').doc(currentCheckData.id).update({ status: 'завершен' });
        
        alert('Спасибо за ваш отчёт ✅');
        currentCheckData = null;
        loadUserDashboard(user.uid);
        showScreen('main-menu-screen');
    });

    async function renderHistory() {
        if (!historyList) return;
        historyList.innerHTML = '<div class="spinner"></div>';
        const user = auth.currentUser;
        if (!user) return;

        const snapshot = await db.collection('reports').where('userId', '==', user.uid).orderBy('checkDate', 'desc').get();
        
        if (snapshot.empty) {
            historyList.innerHTML = '<p>Вы еще не отправили ни одного отчета.</p>';
            return;
        }

        let historyHTML = '';
        snapshot.forEach(doc => {
            const report = doc.data();
            const date = report.checkDate.toDate().toLocaleDateString('ru-RU');
            const statusText = { pending: 'в ожидании', approved: 'принят', rejected: 'отклонен' }[report.status] || report.status;
            
            historyHTML += `
                <li class="menu-list-item history-item">
                    <div class="status-indicator ${report.status}"></div>
                    <div>
                        <strong>${report.locationName}</strong>
                        <small>Дата: ${date} - Статус: ${statusText}</small>
                    </div>
                </li>
            `;
        });
        historyList.innerHTML = historyHTML;
    }


    // --- НАВИГАЦИЯ ---
    const menuButtons = document.querySelectorAll('.menu-btn');
    menuButtons.forEach(b => b.addEventListener('click', (e) => {
        e.preventDefault();
        const target = b.dataset.target;
        if (target === 'cooperation-screen') {
            renderAvailableSchedules();
        } else if (target === 'history-screen') { // <-- ИСПРАВЛЕНИЕ
            renderHistory();
            showScreen(target);
        } else {
            showScreen(target);
        }
    }));

    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(b => b.addEventListener('click', () => showScreen(b.dataset.target)));
});
