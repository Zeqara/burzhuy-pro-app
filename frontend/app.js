// ------------ ЕДИНАЯ КОНФИГУРАЦИЯ FIREBASE (ШАГ 1) ------------
const firebaseConfig = {
  apiKey: "AIzaSyAEEIRVkDj2MTSoI_P7iNtdGqj3Rn_GW-A",
  authDomain: "burzhuy-pro-app.firebaseapp.com",
  projectId: "burzhuy-pro-app",
  storageBucket: "burzhuy-pro-app.appspot.com", // Используем стандартный .appspot.com
  messagingSenderId: "621600130598",
  appId: "1:621600130598:web:5991bcf446b7b0cff088e7",
  measurementId: "G-WBLLKPFF6B"
};
// -------------------------------------------------------------

// ------------ ИНИЦИАЛИЗАЦИЯ СЕРВИСОВ FIREBASE (ШАГ 2) -----------
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
// -------------------------------------------------------------


document.addEventListener('DOMContentLoaded', () => {

    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.expand();
        tg.setHeaderColor('#121212');
        tg.setBackgroundColor('#121212');
    }

    let currentScreen = 'loader';
    let selectedLocation = null; // Будем хранить выбранную точку здесь

    function navigateTo(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const newScreen = document.getElementById(screenId);
        if (newScreen) newScreen.classList.add('active');
        currentScreen = screenId;
    }

    // --- ФУНКЦИЯ: Отображение списка городов ---
    async function renderCities() {
        const cityListContainer = document.getElementById('city-list');
        cityListContainer.innerHTML = '<div class="spinner"></div>'; // Показываем загрузку

        try {
            const locationsSnapshot = await db.collection('locations').get();
            const cities = new Set(); // Используем Set, чтобы города не повторялись
            locationsSnapshot.forEach(doc => {
                cities.add(doc.data().city);
            });
            
            cityListContainer.innerHTML = ''; // Очищаем спиннер

            if (cities.size === 0) {
                 cityListContainer.innerHTML = '<p>Города не найдены.</p>';
                 return;
            }

            cities.forEach(cityName => {
                const button = document.createElement('button');
                button.className = 'menu-btn city-btn';
                button.textContent = cityName;
                button.addEventListener('click', () => showLocationsForCity(cityName));
                cityListContainer.appendChild(button);
            });

        } catch (error) {
            console.error("Ошибка загрузки городов: ", error);
            cityListContainer.innerHTML = '<p>Не удалось загрузить города.</p>';
        }
    }

    // --- ФУНКЦИЯ: Отображение точек для выбранного города ---
    async function showLocationsForCity(cityName) {
        document.getElementById('locations-header').textContent = `Точки в г. ${cityName}`;
        const locationsList = document.getElementById('locations-list');
        locationsList.innerHTML = '<div class="spinner"></div>';
        navigateTo('locations-screen');
        try {
            // Ищем все документы, где поле 'city' равно выбранному городу
            const querySnapshot = await db.collection('locations').where('city', '==', cityName).get();
            locationsList.innerHTML = '';
            if (querySnapshot.empty) {
                locationsList.innerHTML = '<li>Нет доступных точек.</li>';
                return;
            }
            querySnapshot.forEach(doc => {
                const location = { id: doc.id, ...doc.data() };
                const listItem = document.createElement('li');
                listItem.className = 'location-item';
                listItem.innerHTML = `<strong>${location.name}</strong><small>${location.address}</small>`;
                listItem.addEventListener('click', () => selectLocation(location));
                locationsList.appendChild(listItem);
            });
        } catch (error) {
            console.error("Ошибка загрузки точек: ", error);
            locationsList.innerHTML = '<li>Не удалось загрузить точки.</li>';
        }
    }
    
    // --- ФУНКЦИЯ: Выбор точки и переход к чек-листу ---
    function selectLocation(locationData) {
        selectedLocation = locationData; // Сохраняем данные о точке
        document.getElementById('checklist-address').textContent = selectedLocation.address;
        document.getElementById('checklist-date').textContent = new Date().toLocaleString();
        document.getElementById('checklist-form').reset();
        navigateTo('checklist-screen');
    }

    // --- ФУНКЦИЯ: Обработка отправки чек-листа ---
    async function handleChecklistSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';

        try {
            const formData = new FormData(form);
            const checklistData = {
                authorId: auth.currentUser.uid,
                authorPhone: auth.currentUser.email.split('@')[0], // Получаем телефон из email
                locationName: selectedLocation.name,
                locationAddress: selectedLocation.address,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            };

            // Собираем все ответы из формы в виде объекта
            const answers = {};
            for (const [key, value] of formData.entries()) {
                answers[key] = value;
            }
            checklistData.answers = answers; // Добавляем все ответы одним объектом
            
            await db.collection('checklists').add(checklistData);
            
            alert('Спасибо за ваш отчёт!');
            navigateTo('main-menu-screen');

        } catch (error) {
            console.error("Ошибка отправки отчета: ", error);
            alert("Не удалось отправить отчет. Попробуйте снова.");
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Отправить отчёт';
        }
    }

    // --- АУТЕНТИФИКАЦИЯ И НАВИГАЦИЯ ---
    auth.onAuthStateChanged(user => {
        if (user) { 
            navigateTo('main-menu-screen'); 
            renderCities(); // Загружаем города после входа
        } 
        else { 
            navigateTo('auth-screen'); 
        }
    });
    
    document.getElementById('show-register').addEventListener('click', e => { e.preventDefault(); document.getElementById('login-view').style.display = 'none'; document.getElementById('register-view').style.display = 'block'; });
    document.getElementById('show-login').addEventListener('click', e => { e.preventDefault(); document.getElementById('register-view').style.display = 'none'; document.getElementById('login-view').style.display = 'block'; });

    document.getElementById('register-form').addEventListener('submit', async e => {
        e.preventDefault();
        const authError = document.getElementById('auth-error');
        const { name, phone, password } = e.target.elements;
        const email = `${phone.value}@agent.burzhuy`; 
        authError.textContent = '';
        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password.value);
            await db.collection('users').doc(cred.user.uid).set({ name: name.value, phone: phone.value, role: 'agent' });
        } catch (error) { authError.textContent = "Ошибка: " + error.message; }
    });

    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const authError = document.getElementById('auth-error');
        const { phone, password } = e.target.elements;
        const email = `${phone.value}@agent.burzhuy`;
        authError.textContent = '';
        try { await auth.signInWithEmailAndPassword(email, password.value); } 
        catch (error) { authError.textContent = "Ошибка: " + error.message; }
    });

    document.getElementById('logout-btn').addEventListener('click', e => { e.preventDefault(); auth.signOut(); });
    document.querySelectorAll('.menu-btn, .back-btn').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.target)));
    
    document.getElementById('checklist-form').addEventListener('submit', handleChecklistSubmit);
    
    // Начальная проверка состояния пользователя
    setTimeout(() => {
         if (auth.currentUser) { 
             navigateTo('main-menu-screen');
             renderCities(); // Загружаем города, если пользователь уже вошел
         } else {
             navigateTo('auth-screen');
         }
    }, 500);

});
