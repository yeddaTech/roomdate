 <?php
// Mostra subito tutti gli errori PHP
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'db.php';
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

$user_id = (int)$_SESSION['user_id'];

// Recupera immagine profilo utente loggato
$profileImage = 'images/default.png';
try {
    $stmt = $pdo->prepare("SELECT image_url FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $userRow = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!empty($userRow['image_url'])) {
        $profileImage = $userRow['image_url'];
    }
} catch (PDOException $e) {
    die("Errore recupero immagine profilo: " . $e->getMessage());
}

// Funzione per caricare like o dislike
function fetchList(PDO $pdo, int $user_id, string $action) {
    try {
        $sql = "
            SELECT u.id, u.name AS display_name, u.description AS bio, u.image_url
            FROM interactions i
            JOIN users u ON u.id = i.target_id
            WHERE i.user_id = ? AND i.action = ?
            ORDER BY i.created_at DESC
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$user_id, $action]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        echo "Errore fetchList: " . $e->getMessage();
        return [];
    }
}

// Like e Dislike
$likes = fetchList($pdo, $user_id, 'like');
$dislikes = fetchList($pdo, $user_id, 'dislike');

// Match reciproci: entrambi si sono messi "like"
try {
    $sqlMatches = "
        SELECT DISTINCT u.id, u.name AS display_name, u.description AS bio, u.image_url
        FROM interactions m1
        JOIN interactions m2 ON m1.target_id = m2.user_id AND m1.user_id = m2.target_id
        JOIN users u ON u.id = m1.target_id
        WHERE m1.user_id = ? AND m1.action = 'like' AND m2.action = 'like'
        ORDER BY m1.created_at DESC
    ";
    $stmt = $pdo->prepare($sqlMatches);
    $stmt->execute([$user_id]);
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("Errore query match: " . $e->getMessage());
}
?>

<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RoomDate – Match</title>
<link rel="stylesheet" href="css/style.css?v=<?= time() ?>">
<style>
/* FONT E COLORI PRINCIPALI */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

:root {
  --gold: #dda130;
  --rose: #ff4d6d;
  --ink: #0a0a0a;
  --card: #101010;
  --muted: #bdbdbd;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
@keyframes gradientAnimation {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

body {
  font-family: 'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: #fff;
  line-height: 1.5;

  /* Linear gradient globale su tutta la pagina */
  background: linear-gradient(135deg, #000000, #1a1a1a, #dda130, #ff4d6d);
  background-size: 400% 400%;
  animation: gradientAnimation 15s ease infinite;
}

/* HEADER */
.app-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.app-header nav a {
  margin-left: 12px;
  text-decoration: none;
  color: #fff;
  font-weight: 600;
  transition: all 0.25s ease;
}

.app-header nav a:hover {
  color: var(--gold);
  transform: translateY(-2px);
}

.avatar {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--gold);
}

.btn-logout {
  margin-left: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  background-color: var(--rose);
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: all 0.25s ease;
}

.btn-logout:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

/* HERO */
.page-hero {
  background: linear-gradient(90deg, #000, var(--gold));
  padding: 40px 24px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  text-align: center;
}

.page-hero h1 {
  font-size: 2rem;
  font-weight: 700;
}

/* WRAPPER E GRID */
.wrapper {
  max-width: 1100px;
  margin: 28px auto;
  padding: 0 20px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}

/* SEZIONI */
.section {
  grid-column: 1/-1;
  background: linear-gradient(180deg, #0b0b0b, #0f0f0f);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  padding: 18px 16px 12px;
  box-shadow: 0 12px 30px rgba(0,0,0,0.35);
  animation: rise 0.6s ease both;
  margin-bottom: 20px;
}

.section h2 {
  font-size: 1.2rem;
  margin-bottom: 14px;
  color: #fff;
}

/* CARDS */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
  padding: 8px 0;
}

.card {
  background: var(--card);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 14px;
  display: flex;
  gap: 12px;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s ease, border-color 0.25s ease;
}

.card:hover {
  transform: translateY(-4px);
  border-color: rgba(221,161,48,0.35);
}

.thumb {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
}

.meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.name {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bio {
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.3;
  max-height: 3em;
  overflow: hidden;
}

/* BADGE */
.badge {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.badge.like {
  background: rgba(46,213,118,0.15);
  color: #2ed573;
  border: 1px solid rgba(46,213,118,0.35);
}

.badge.dislike {
  background: rgba(255,107,129,0.12);
  color: #ff6b81;
  border: 1px solid rgba(255,107,129,0.3);
}

.badge.match {
  background: rgba(255,77,109,0.12);
  color: var(--rose);
  border: 1px solid rgba(255,77,109,0.35);
}

/* BUTTON CHAT */
.btn-chat {
  margin-top: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  background-color: #fff;
  color: #000;
  font-weight: 700;
  text-decoration: none;
  display: inline-block;
  transition: all 0.25s ease;
}

.btn-chat:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

/* ANIMAZIONE RISE */
@keyframes rise {
  from { opacity: 0; transform: translateY(8px);}
  to { opacity: 1; transform: translateY(0);}
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
                <img src="<?= htmlspecialchars($profileImage) ?>" alt="Profilo" class="avatar">
         </a>
        <a href="logout.php" class="btn-logout">Logout</a>
    </div>
</header>


<main class="wrapper">
  <div class="grid">
  <section class="section">
      <h2>🔥 Match reciproci</h2>
      <div class="cards">
        <?php if (!empty($matches)): foreach ($matches as $u): ?>
          <article class="card">
            <span class="badge match">MATCH</span>
            <img class="thumb" src="<?= htmlspecialchars($u['image_url'] ?: 'images/default.png') ?>" alt="">
            <div class="meta">
              <div class="name"><?= htmlspecialchars($u['display_name']) ?></div>
              <div class="bio"><?= htmlspecialchars($u['bio'] ?? '') ?></div>
              <a class="btn-chat" href="chat.php?user=<?= (int)$u['id'] ?>">💬 Chatta</a>
            </div>
          </article>
        <?php endforeach; else: ?>
          <p style="color:#bdbdbd;margin:6px 12px">Ancora nessun match. Continua a esplorare! 😉</p>
        <?php endif; ?>
      </div>
    </section>
    <!-- LIKE -->
    <section class="section">
      <h2>❤️ Like dati</h2>
      <div class="cards">
        <?php if (!empty($likes)): foreach ($likes as $u): ?>
          <article class="card">
            <span class="badge like">LIKE</span>
            <img class="thumb" src="<?= htmlspecialchars($u['image_url'] ?: 'images/default.png') ?>" alt="">
            <div class="meta">
              <div class="name"><?= htmlspecialchars($u['display_name']) ?></div>
              <div class="bio"><?= htmlspecialchars($u['bio'] ?? '') ?></div>
            </div>
          </article>
        <?php endforeach; else: ?>
          <p style="color:#bdbdbd;margin:6px 12px">Non hai ancora messo like a nessuno.</p>
        <?php endif; ?>
      </div>
    </section>

    <!-- DISLIKE -->
    <section class="section">
      <h2>💔 Dislike dati</h2>
      <div class="cards">
        <?php if (!empty($dislikes)): foreach ($dislikes as $u): ?>
          <article class="card">
            <span class="badge dislike">DISLIKE</span>
            <img class="thumb" src="<?= htmlspecialchars($u['image_url'] ?: 'images/default.png') ?>" alt="">
            <div class="meta">
              <div class="name"><?= htmlspecialchars($u['display_name']) ?></div>
              <div class="bio"><?= htmlspecialchars($u['bio'] ?? '') ?></div>
            </div>
          </article>
        <?php endforeach; else: ?>
          <p style="color:#bdbdbd;margin:6px 12px">Nessun dislike registrato.</p>
        <?php endif; ?>
      </div>
    </section>

    <!-- MATCH -->
    
  </div>
</main>

</body>
</html>