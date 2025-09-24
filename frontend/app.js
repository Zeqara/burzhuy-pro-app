document.addEventListener('DOMContentLoaded', () => {
    // --- ВАШИ КЛЮЧИ FIREBASE ---
    const firebaseConfig = {
      apiKey: "AIzaSyAEEIRVkDj2MTSoI_P7iNtdGqj3Rn_GW-A",
      authDomain: "burzhuy-pro-app.firebaseapp.com",
      projectId: "burzhuy-pro-app",
      storageBucket: "burzhuy-pro-app.appspot.com",
      messagingSenderId: "621600130598",
      appId: "1:621600130598:web:5991bcf446b7b0cff088e7",
      measurementId: "G-WBLLKPFF6B"
    };
    // ----------------------------

    // Инициализация Firebase (старый, совместимый синтаксис)
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    const tg = window.Telegram.WebApp;
    tg.expand();
    tg.setHeaderColor('#121212');
    tg.setBackgroundColor('#121212');

    const screens = document.querySelectorAll('.screen');
    let currentScreen = 'loader';

    function navigateTo(screenId) {
        const oldScreen = document.getElementById(currentScreen);
        const newScreen = document.getElementById(screenId);
        
        if (oldScreen && newScreen) {
            oldScreen.classList.add('exit-left');
            setTimeout(() => {
                oldScreen.classList.remove('active', 'exit-left');
                newScreen.classList.add('active');
                currentScreen = screenId;
            }, 400);
        }
    }

    auth.onAuthStateChanged(user => {
        if (user) {
            console.log("Пользователь вошел:", user.uid);
            navigateTo('main-menu-screen');
        } else {
            console.log("Пользователь вышел.");
            navigateTo('auth-screen');
        }
    });

    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('register-view').style.display = 'block';
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-view').style.display = 'none';
        document.getElementById('login-view').style.display = 'block';
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const authError = document.getElementById('auth-error');
        const name = document.getElementById('register-name').value;
        const phone = document.getElementById('register-phone').value;
        const password = document.getElementById('register-password').value;
        const email = `${phone}@agent.burzhuy`; 
        authError.textContent = '';

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await db.collection('users').doc(user.uid).set({
                name: name,
                phone: phone,
                role: 'agent',
                registeredAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            authError.textContent = "Ошибка регистрации: " + error.message;
        }
    });
    
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const authError = document.getElementById('auth-error');
        const phone = document.getElementById('login-phone').value;
        const password = document.getElementById('login-password').value;
        const email = `${phone}@agent.burzhuy`;
        authError.textContent = '';

        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            authError.textContent = "Ошибка входа: " + error.message;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut();
    });

    document.querySelectorAll('.menu-btn, .back-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.target);
        });
    });

    document.getElementById('support-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('support-status');
        status.textContent = "Отправка...";
        
        try {
            await db.collection('supportTickets').add({
                name: document.getElementById('support-name').value,
                phone: document.getElementById('support-phone').value,
                message: document.getElementById('support-message').value,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: auth.currentUser ? auth.currentUser.uid : 'guest'
            });
            status.textContent = "Ваше обращение отправлено!";
            e.target.reset();
        } catch (error) {
            status.textContent = `Ошибка: ${error.message}`;
        }
    });

    setTimeout(() => {
         if (!auth.currentUser) {
            navigateTo('auth-screen');
         }
    }, 500);
});
