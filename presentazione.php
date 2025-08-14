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
/* Font elegante */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

body {
    margin: 0;
    font-family: 'Poppins', sans-serif;
    background-color: #000;
    color: #fff;
    overflow-x: hidden;
    opacity: 0;
    animation: fadeIn 1.2s ease forwards;
}

/* Animazione di fade-in */
@keyframes fadeIn {
    0% { opacity: 0; transform: translateY(15px); }
    100% { opacity: 1; transform: translateY(0); }
}

header.app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 40px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(6px);
    position: sticky;
    top: 0;
    z-index: 1000;
}

header img {
    width: 130px;
}

nav a {
    margin: 0 12px;
    color: #fff;
    text-decoration: none;
    font-weight: 500;
    position: relative;
    transition: color 0.3s ease;
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

/* HERO SECTION */
.hero {
    text-align: center;
    padding: 120px 20px;
    background: linear-gradient(90deg, #000000, #dda130);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 80px);
    animation: heroFade 1.2s ease-in-out forwards;
}

@keyframes heroFade {
    0% { opacity: 0; transform: scale(1.05); }
    100% { opacity: 1; transform: scale(1); }
}

.hero h1 {
    font-size: 3.2rem;
    font-weight: 700;
    margin-bottom: 15px;
}

.hero p {
    font-size: 1.4rem;
    max-width: 600px;
    margin-bottom: 40px;
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
}

.hero a:hover {
    background-color: #f0f0f0;
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 8px 20px rgba(0,0,0,0.4);
}
</style>
</head>
<body>

<header class="app-header">
    <div style="display:flex; align-items:center;">
        <a href="index.php" class="logo-link"><img src="images/logo.png" alt="RoomDate Logo"></a>
        <nav>
            <a href="presentazione.php" class="header-btn">Presentazione</a>
            <a href="index.php" class="header-btn">Home</a>
            <a href="match.php" class="header-btn">Match</a>
        </nav>
    </div>
    <div style="display:flex; align-items:center; gap:12px;">
         <a href="profile.php" class="profile-link" style="margin-right:15px;">
            <img src="<?= htmlspecialchars($profileImage) ?>" alt="Profilo" style="width:45px; height:45px; object-fit:cover; border-radius:50%; border:2px solid #dda130;">
         </a>
        <a href="logout.php" class="btn-logout">Logout</a>
    </div>
</header>

<main class="hero">
    <h1>Benvenuto su <span style="color:#ff4d6d;">RoomDate</span></h1>
    <p>Trova il coinquilino perfetto in modo semplice, veloce e divertente. La casa giusta inizia da qui!</p>
    <a href="match.php">🔥 Inizia a fare match</a>
</main>

</body>
</html>