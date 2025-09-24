document.addEventListener('DOMContentLoaded', () => {
    // --- ВАЖНО: Вставьте ВАШ firebaseConfig сюда ---
    const firebaseConfig = {
      apiKey: "AIzaSyAEEIRVkDj2MTSoI_P7iNtdGqj3Rn_GW-A",
      authDomain: "burzhuy-pro-app.firebaseapp.com",
      projectId: "burzhuy-pro-app",
      storageBucket: "burzhuy-pro-app.appspot.com",
      messagingSenderId: "621600130598",
      appId: "1:621600130598:web:5991bcf446b7b0cff088e7",
      measurementId: "G-WBLLKPFF6B"
    };
    // ---------------------------------------------

    // Используем совместимый синтаксис
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#121212');
    tg.setBackgroundColor('#121212');

    let currentScreen = 'loader';

    // Улучшенная функция навигации, чтобы избежать наложений
    function navigateTo(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const newScreen = document.getElementById(screenId);
        if (newScreen) newScreen.classList.add('active');
        currentScreen = screenId;
    }

    // --- ОСНОВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ ---

    // 1. Отображение списка городов
    function renderCities() {
        const cities = {
            pavlodar: 'Павлодар',
            ekibastuz: 'Экибастуз',
            oskemen: 'Усть-Каменогорск'
        };
        const cityListContainer = document.getElementById('city-list');
        cityListContainer.innerHTML = '';
        for (const cityId in cities) {
            const button = document.createElement('button');
            button.className = 'menu-btn city-btn';
            button.dataset.cityId = cityId;
            button.textContent = cities[cityId];
            button.addEventListener('click', () => showLocationsForCity(cityId, cities[cityId]));
            cityListContainer.appendChild(button);
        }
    }

    // 2. Показать точки для выбранного города
    async function showLocationsForCity(cityId, cityName) {
        document.getElementById('locations-header').textContent = `Точки в г. ${cityName}`;
        const locationsList = document.getElementById('locations-list');
        locationsList.innerHTML = '<div class="spinner"></div>';
        navigateTo('locations-screen');

        try {
            const querySnapshot = await db.collection('locations').where('city', '==', cityId).get();
            locationsList.innerHTML = '';
            if (querySnapshot.empty) {
                locationsList.innerHTML = '<li>Нет доступных точек.</li>';
                return;
            }
            querySnapshot.forEach(doc => {
                const location = doc.data();
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

    // 3. Выбор точки и переход к чек-листу
    function selectLocation(location) {
        document.getElementById('checklist-address').textContent = location.address;
        document.getElementById('checklist-date').textContent = new Date().toLocaleString();
        document.getElementById('checklist-form').reset();
        navigateTo('checklist-screen');
    }
    
    // --- АУТЕНТИФИКАЦИЯ И НАВИГАЦИЯ ---
    auth.onAuthStateChanged(user => {
        if (user) { navigateTo('main-menu-screen'); } 
        else { navigateTo('auth-screen'); }
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

    // Вызов начальной функции
    renderCities();

    // Запускаем приложение после небольшой задержки
    setTimeout(() => {
         if (!auth.currentUser) {
            navigateTo('auth-screen');
         } else {
            navigateTo('main-menu-screen');
         }
    }, 500);
});
