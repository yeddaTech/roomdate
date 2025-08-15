<?php
require_once 'db.php';

// No-cache headers
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

// Recupera immagine profilo utente loggato
$stmt = $pdo->prepare("SELECT image_url FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$currentUser = $stmt->fetch(PDO::FETCH_ASSOC);
$profileImage = !empty($currentUser['image_url']) ? $currentUser['image_url'] : 'images/default.png';
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RoomDate - Presentazione</title>
<?php $cssPath = __DIR__ . '/css/style.css'; ?>
<link rel="stylesheet" href="css/style.css?v=<?= file_exists($cssPath) ? filemtime($cssPath) : time() ?>">
<style>
/* FONT E BACKGROUND */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

body {
    margin: 0;
    font-family: 'Poppins', sans-serif;
    background: linear-gradient(90deg, #000000, #dda130);
    color: #fff;
    overflow-x: hidden;
    opacity: 0;
    animation: fadeIn 1.2s ease forwards;
}

/* FADE-IN GENERALE */
@keyframes fadeIn {
    0% { opacity: 0; transform: translateY(15px); }
    100% { opacity: 1; transform: translateY(0); }
}

/* HEADER TRASPARENTE */
header.app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 40px;
    background: transparent;
    position: sticky;
    top: 0;
    z-index: 1000;
}

header img {
    width: 130px;
    transition: transform 0.4s ease;
}
header img:hover {
    transform: rotate(-5deg) scale(1.05);
}

nav a {
    margin: 0 12px;
    color: #fff;
    text-decoration: none;
    font-weight: 500;
    position: relative;
    transition: color 0.3s ease, transform 0.3s ease;
}
nav a::after {
    content: "";
    position: absolute;
    width: 0%;
    height: 2px;
    bottom: -4px;
    left: 0;
    background: #dda130;
    transition: width 0.3s ease;
}
nav a:hover {
    color: #dda130;
    transform: translateY(-3px);
}
nav a:hover::after {
    width: 100%;
}

.btn-logout {
    background: #ff4d6d;
    color: white;
    padding: 8px 18px;
    border-radius: 20px;
    text-decoration: none;
    font-weight: 600;
    transition: all 0.3s ease;
}
.btn-logout:hover {
    background: #e03c5d;
    transform: scale(1.05);
}

/* HERO */
.hero {
    text-align: center;
    padding: 120px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 80px);
    animation: heroFade 1.2s ease-in-out forwards;
}
@keyframes heroFade {
    0% { opacity: 0; transform: scale(1.05) translateY(20px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
}
.hero h1 {
    font-size: 3.2rem;
    font-weight: 700;
    margin-bottom: 15px;
    color: #f0f0f0;
    animation: fadeSlideIn 1s ease forwards;
}
.hero p {
    font-size: 1.4rem;
    max-width: 600px;
    margin-bottom: 40px;
    animation: fadeSlideIn 1s ease 0.3s forwards;
}
.hero a {
    background-color: white;
    color: #ff4d6d;
    font-size: 1.3rem;
    padding: 14px 40px;
    border-radius: 40px;
    text-decoration: none;
    font-weight: bold;
    transition: all 0.3s ease-in-out;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    animation: fadeSlideIn 1s ease 0.6s forwards;
}
.hero a:hover {
    background-color: #f0f0f0;
    transform: translateY(-10px) scale(1.08);
    box-shadow: 0 8px 20px rgba(0,0,0,0.4);
    animation: bounce 0.6s infinite alternate;
}
@keyframes fadeSlideIn {
    0% { opacity: 0; transform: translateY(20px); }
    100% { opacity: 1; transform: translateY(0); }
}
@keyframes bounce {
    0% { transform: translateY(-4px) scale(1.05); }
    100% { transform: translateY(-10px) scale(1.08); }
}

/* CURIOSITÀ */
.curiosita {
    padding: 80px 20px;
    text-align: center;
    background: transparent;
}
.curiosita h2 {
    font-size: 2.5rem;
    color: #dda130;
    margin-bottom: 50px;
    text-shadow: 0 0 12px rgba(221,161,48,0.3);
}

/* CARDS */
.cards {
    display: flex;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
}
.card {
    background: rgba(255,255,255,0.06);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 25px;
    width: 280px;
    color: #fff;
    text-align: center;
    box-shadow: 0 6px 20px rgba(0,0,0,0.5);
    opacity: 0;
    transform: translateY(30px) scale(0.9);
    transition: all 0.8s cubic-bezier(0.17, 0.67, 0.83, 0.67);
}
.card.show {
    opacity: 1;
    transform: translateY(0) scale(1);
}
.card:hover {
    transform: translateY(-10px) scale(1.05);
    box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
.card img {
    width: 80px;
    margin-bottom: 15px;
    transition: transform 0.6s ease;
}
.card:hover img {
    transform: rotate(-5deg) scale(1.1);
}

/* REGOLE */
.regole {
    background: transparent;
    padding: 60px 20px;
    text-align: center;
    color: #f0f0f0;
}
.regole h2 {
    font-size: 2.2rem;
    margin-bottom: 30px;
    color: rgb(255,0,0);
    text-shadow: 0 0 12px rgba(221,161,48,0.3);
}
.regole ul {
    list-style: none;
    padding: 0;
    max-width: 800px;
    margin: 0 auto;
    font-size: 1.3rem;
    line-height: 1.8;
    text-align: left;
    color: #f0f0f0;
}
.regole li {
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateX(-20px);
    transition: all 0.6s ease;
}
.regole li.show {
    opacity: 1;
    transform: translateX(0);
}

/* RESPONSIVE */
@media (max-width: 768px) {
    .cards {
        flex-direction: column;
        align-items: center;
    }
}
</style>
</head>
<body>

<!-- HEADER -->
<div style="display:flex; align-items:center; justify-content:space-between; padding:15px 40px;">
    <div style="display:flex; align-items:center;">
        <a href="index.php" class="logo-link"><img src="images/logo.png" alt="RoomDate Logo"></a>
        <div class="header-buttons" style="margin-left:30px;">
            <a href="presentazione.php" class="header-btn">Presentazione</a>
            <a href="index.php" class="header-btn">Home</a>
            <a href="match.php" class="header-btn">Match</a>
        </div>
    </div>
    <div style="display:flex; align-items:center; gap:12px;">
         <a href="profile.php" class="profile-link" style="margin-right:15px;">
            <img src="<?= htmlspecialchars($profileImage) ?>" alt="Profilo" style="width:45px; height:45px; object-fit:cover; border-radius:50%; border:2px solid #dda130;">
         </a>
        <a href="logout.php" class="btn-logout">Logout</a>
    </div>
</div>

<!-- HERO -->
<main class="hero">
    <h1>Benvenuto su <span style="color:#ff4d6d;">RoomDate</span></h1>
    <p>Trova il coinquilino perfetto in modo semplice, veloce e divertente. La casa giusta inizia da qui!</p>
    <a href="index.php">🔥 Inizia a fare match</a>
</main>

<!-- CURIOSITÀ -->
<section class="curiosita">
    <h2>Curiosità sui Coinquilini</h2>
    <div class="cards">
        <div class="card" data-animate>
            <img src="images/fun-roommate.jpg" alt="Coinquilino divertente">
            <p>Il 60% dei coinquilini diventa anche amico stretto! 🎉</p>
        </div>
        <div class="card" data-animate>
            <img src="images/clean-room.jpg" alt="Stanza ordinata">
            <p>Un coinquilino ordinato riduce lo stress del 40%! ✨</p>
        </div>
        <div class="card" data-animate>
            <img src="images/cooking.jpg" alt="Coinquilini che cucinano">
            <p>Cucinare insieme è il segreto per legare meglio. 🍲</p>
        </div>
    </div>
</section>

<!-- REGOLE -->
<section class="regole">
    <h2>Regole della Community</h2>
    <ul>
        <li>✅ Mantieni sempre un atteggiamento rispettoso verso gli altri.</li>
        <li>🚫 Non sono ammessi contenuti o argomenti espliciti nelle chat.</li>
        <li>🔒 Per motivi di sicurezza, i match avvengono tra persone dello stesso sesso.</li>
        <li>💡 Segnala comportamenti scorretti: la community è più sicura grazie a te!</li>
    </ul>
</section>

<script>
// ANIMAZIONE CARDS
const elements = document.querySelectorAll('[data-animate]');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if(entry.isIntersecting) {
            const el = entry.target;
            if(!el.classList.contains('show')) {
                const delay = el.dataset.delay || 0;
                setTimeout(() => el.classList.add('show'), delay);
            }
        }
    });
}, { threshold: 0.2 });

elements.forEach((el, index) => {
    el.dataset.delay = index * 150; // sequenza
    observer.observe(el);
});

// ANIMAZIONE REGOLE
const regoleItems = document.querySelectorAll('.regole li');
regoleItems.forEach((li, i) => {
    setTimeout(() => li.classList.add('show'), i * 200);
});
</script>

</body>
</html>
