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

// Recupera altri utenti
try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id != ?");
    $stmt->execute([$_SESSION['user_id']]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    $users = [];
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
<title>Roomdate</title>
<?php $cssPath = __DIR__ . '/css/style.css'; ?>
<link rel="stylesheet" href="css/style.css?v=<?= file_exists($cssPath) ? filemtime($cssPath) : time() ?>">
</head>
<body>

<header class="app-header">
    <div style="display:flex; align-items:center;">
        <a href="index.php" class="logo-link"><img src="images/logo.png" alt="RoomDate Logo"></a>
       <div class="header-buttons">
        <a href="presentazione.php" class="header-btn">Presentazione</a>
          <a href="index.php" class="header-btn">Home</a>
         <a href="match.php" class="header-btn">Match</a>
</div>

    </div>
    <div style="display:flex; align-items:center; gap:12px;">
         <a href="profile.php" class="profile-link" style="margin-right:15px;">
                <img src="<?= htmlspecialchars($profileImage) ?>" alt="Profilo" style="width:45px; height:45px; object-fit:cover; border-radius:50%; border:2px solid #ccc;">
         </a>
        <a href="logout.php" class="btn-logout">Logout</a>
    </div>
</header>

<main class="app-content" id="app-content">
  <div id="swipe-container">
    <!-- Qui dentro c'è il div che conterrà immagine e descrizione -->
    <div class="profile-card" id="profile-card"></div>
  </div>
  <div class="action-buttons">
    <button class="btn btn-reject" type="button" aria-label="Rifiuta">✖</button>
    <button class="btn btn-chat" type="button" aria-label="Chat">💬</button>
    <button class="btn btn-accept" type="button" aria-label="Accetta">✓</button>
  </div>
</main>


<button id="open-conversations-btn" type="button" aria-label="Apri chat attive">Chat attive</button>

<aside id="conversations-sidebar" class="conversations-sidebar" aria-label="Sidebar chat attive">
  <h3>Chat attive</h3>
  <ul id="conversations-list" role="list"></ul>
  <button id="close-conversations-btn" type="button" aria-label="Chiudi chat attive">Chiudi</button>
</aside>

<aside id="chat-panel" class="chat-panel" aria-live="polite" aria-label="Chat privata">
    <div class="chat-header">
        <h2>Chat con <span id="chat-user-name">Utente</span></h2>
        <button class="close-btn" type="button" onclick="closeChat()" aria-label="Chiudi chat">✖</button>
    </div>
    <div class="chat-messages" id="chat-messages" role="log"></div>
    <div class="chat-input-area">
        <input id="chat-input" type="text" placeholder="Scrivi un messaggio..." aria-label="Messaggio" autocomplete="off" />
        <button class="send-btn" type="button" aria-label="Invia messaggio">Invia</button>
    </div>
</aside>
<script>
const profiles = <?= json_encode($users, JSON_UNESCAPED_UNICODE) ?>;
let currentIndex = 0;
let chatWithUserId = null;
let chatWithUserName = '';
let fetchInterval = null;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));
}
function showProfile(index) {
  const container = document.getElementById("profile-card");
  if (!profiles.length) {
    container.innerHTML = "<p>Nessun profilo disponibile</p>";
    return;
  }
  const p = profiles[index];
  const img = p.image_url && p.image_url.trim() !== '' ? p.image_url : "images/default.png";
  container.innerHTML = `
    <div class="profile-images">
      <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" />
    </div>
    <div class="profile-info">
      <h2>${escapeHtml(p.name)}</h2>
      <p>${escapeHtml(p.description || '')}</p>
    </div>
  `;
  container.style.transform = 'translate(0, 0) rotate(0)';
  container.style.transition = 'none';
}






function nextProfile() {
  if (!profiles.length) return;
  currentIndex = (currentIndex + 1) % profiles.length;
  showProfile(currentIndex);
}

/* --- SWIPE DRAG --- */
let startX, startY, currentX, currentY, isDragging = false;
const card = document.getElementById('profile-card');

function startDrag(e) {
  isDragging = true;
  startX = (e.touches ? e.touches[0].clientX : e.clientX);
  startY = (e.touches ? e.touches[0].clientY : e.clientY);
  card.style.transition = 'none';

  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
  document.addEventListener('touchmove', onDrag);
  document.addEventListener('touchend', endDrag);
}

function onDrag(e) {
  if (!isDragging) return;
  currentX = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
  currentY = (e.touches ? e.touches[0].clientY : e.clientY) - startY;
  
  const rotate = currentX * 0.05;
  card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
}

function endDrag() {
  isDragging = false;
  const threshold = 100;
  
  if (currentX > threshold) {
    card.style.transition = 'transform 0.3s ease';
    card.style.transform = 'translate(500px, 0) rotate(20deg)';
    setTimeout(nextProfile, 300);
  } else if (currentX < -threshold) {
    card.style.transition = 'transform 0.3s ease';
    card.style.transform = 'translate(-500px, 0) rotate(-20deg)';
    setTimeout(nextProfile, 300);
  } else {
    card.style.transition = 'transform 0.3s ease';
    card.style.transform = 'translate(0, 0) rotate(0)';
  }

  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
  document.removeEventListener('touchmove', onDrag);
  document.removeEventListener('touchend', endDrag);
}

/* --- CHAT FUNZIONI ESISTENTI --- */
function openChatWithUser(userId, userName) {
  chatWithUserId = userId;
  chatWithUserName = userName;
  document.getElementById('chat-user-name').textContent = userName;
  document.getElementById("chat-panel").classList.add("open");
  fetchMessages();
  if (fetchInterval) clearInterval(fetchInterval);
  fetchInterval = setInterval(fetchMessages, 2000);
}

function closeChat() {
  document.getElementById("chat-panel").classList.remove("open");
  if (fetchInterval) {
    clearInterval(fetchInterval);
    fetchInterval = null;
  }
}

async function fetchMessages() {
  if (!chatWithUserId) return;
  try {
    const response = await fetch(`messages_handler.php?action=fetch&other_id=${chatWithUserId}`);
    const data = await response.json();
    if (data.error) return;
    const messagesContainer = document.getElementById("chat-messages");
    messagesContainer.innerHTML = '';
    data.messages.forEach(m => {
      const div = document.createElement('div');
      div.classList.add('message', m.sender_id === <?= $_SESSION['user_id'] ?> ? 'sent' : 'received');
      div.innerHTML = `<strong>${m.sender_id === <?= $_SESSION['user_id'] ?> ? 'Tu' : escapeHtml(m.sender_name)}:</strong> ${escapeHtml(m.message)}`;
      messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (err) {
    console.error("Errore caricamento messaggi:", err);
  }
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message || !chatWithUserId) return;
  try {
    const formData = new FormData();
    formData.append('action', 'send');
    formData.append('receiver_id', chatWithUserId);
    formData.append('message', message);
    const response = await fetch('messages_handler.php', { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) {
      input.value = '';
      await fetchMessages();
    } else if (data.error) {
      alert(data.error);
    }
  } catch (err) {
    console.error("Errore invio messaggio:", err);
    alert("Errore di rete. Riprova più tardi.");
  }
}

async function loadConversations() {
  try {
    const res = await fetch('messages_handler.php?action=conversations');
    const data = await res.json();
    if (!data.conversations) return;
    const list = document.getElementById('conversations-list');
    list.innerHTML = '';
    data.conversations.forEach(user => {
      const img = user.image_url && user.image_url.trim() !== '' ? user.image_url : 'images/default.png';
      const li = document.createElement('li');
      li.setAttribute('tabindex', 0);
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', 'Apri chat con ' + user.name);
      li.innerHTML = `<img src="${escapeHtml(img)}" alt="${escapeHtml(user.name)}" /> <span class="user-name">${escapeHtml(user.name)}</span>`;
      li.addEventListener('click', () => openChatWithUser(user.id, user.name));
      li.addEventListener('keypress', e => { if (e.key === 'Enter' || e.key === ' ') openChatWithUser(user.id, user.name); });
      list.appendChild(li);
    });
  } catch (e) {
    console.error('Errore caricamento conversazioni:', e);
  }
}

function keepAlive() {
  fetch('keepalive.php').catch(err => console.log("Keepalive error:", err));
}

document.addEventListener("DOMContentLoaded", () => {
  showProfile(currentIndex);

  // Pulsanti
document.querySelector(".btn-accept").addEventListener("click", async () => {
    const profile = profiles[currentIndex];
    if (profile) {
        await sendInteraction(profile.id, 'like');
    }
    card.style.transition = 'transform 0.3s ease';
    card.style.transform = 'translate(500px, 0) rotate(20deg)';
    setTimeout(nextProfile, 300);
});

document.querySelector(".btn-reject").addEventListener("click", async () => {
    const profile = profiles[currentIndex];
    if (profile) {
        await sendInteraction(profile.id, 'dislike');
    }
    card.style.transition = 'transform 0.3s ease';
    card.style.transform = 'translate(-500px, 0) rotate(-20deg)';
    setTimeout(nextProfile, 300);
});
async function sendInteraction(targetId, action) {
    try {
        const res = await fetch('interaction_handler.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({target_id: targetId, action: action})
        });
        const data = await res.json();
        if (!data.success) {
            console.error("Errore invio interazione:", data.error);
        }
    } catch (err) {
        console.error("Errore rete interazione:", err);
    }
}
  document.querySelector(".btn-chat").addEventListener("click", () => {
    const profile = profiles[currentIndex];
    if (profile) openChatWithUser(profile.id, profile.name);
  });

  document.querySelector(".send-btn").addEventListener("click", sendMessage);
  document.getElementById("chat-input").addEventListener("keypress", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  // Swipe eventi
  card.addEventListener('mousedown', startDrag);
  card.addEventListener('touchstart', startDrag);

  document.getElementById('open-conversations-btn').addEventListener('click', () => {
    document.getElementById('conversations-sidebar').classList.add('open');
    document.getElementById('open-conversations-btn').style.display = 'none';
    document.getElementById('app-content').classList.add('with-sidebar');
    loadConversations();
  });

  document.getElementById('close-conversations-btn').addEventListener('click', () => {
    document.getElementById('conversations-sidebar').classList.remove('open');
    document.getElementById('open-conversations-btn').style.display = 'inline-flex';
    document.getElementById('app-content').classList.remove('with-sidebar');
  });

  loadConversations();
  setInterval(loadConversations, 30000);
  setInterval(() => fetch('check_online.php'), 120000);
  setInterval(keepAlive, 60000);
  window.addEventListener('mousemove', keepAlive);
  window.addEventListener('keypress', keepAlive);
});
</script>


<?php if (isset($_SESSION['user_id'])): ?>
    <?php include 'online_users_widget.php'; ?>
<?php endif; ?>
</body>
</html>