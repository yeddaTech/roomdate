<?php
require_once 'db.php';

$stmt = $pdo->query("SELECT * FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Roomdate</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="app-header">
    <h1 class="app-title">ROOMDATE</h1>
  </header>
  <main class="app-content">
    <div class="profile-card" id="profile-card">
      <!-- Qui JS riempirà il profilo -->
    </div>
    <div class="action-buttons">
      <button class="btn btn-reject" aria-label="Rifiuta">✖</button>
      <button class="btn btn-chat">Chat now</button>
      <button class="btn btn-accept" aria-label="Accetta">✓</button>
    </div>
  </main>

  <button class="floating-chat-button" onclick="openChat()">
    <span>Start chatting</span>
  </button>

  <aside id="chat-panel" class="chat-panel">
    <div class="chat-header">
      <h2>Chat Room</h2>
      <button class="close-btn" onclick="closeChat()" aria-label="Chiudi chat">✖</button>
    </div>
    <div class="chat-messages">
      <div class="message received"><strong>Anna:</strong> Ciao! Come stai?</div>
      <div class="message sent"><strong>Tu:</strong> Tutto bene, grazie!</div>
    </div>
    <div class="chat-input-area">
      <input id="chat-input" type="text" placeholder="Scrivi un messaggio..." aria-label="Messaggio" />
      <button class="send-btn">Invia</button>
    </div>
  </aside>

  <script>
    // Passa utenti PHP a JS
    const profiles = <?php echo json_encode($users); ?>;
    let currentIndex = 0;

    function showProfile(index) {
      const profileContainer = document.getElementById("profile-card");
      if (!profiles.length) {
        profileContainer.innerHTML = "<p>Nessun profilo disponibile</p>";
        return;
      }
      profileContainer.innerHTML = `
        <div class="profile-images">
          <img src="${profiles[index].image_url}" alt="${profiles[index].name}" style="width: 100%; height: 100%; border-radius: 10px;" />
        </div>
        <div class="profile-info" style="margin-top: 1rem; text-align: center;">
          <h2>${profiles[index].name}</h2>
          <p>${profiles[index].description}</p>
        </div>
      `;
    }

    function nextProfile() {
      currentIndex++;
      if (currentIndex >= profiles.length) {
        alert("Nessun altro profilo disponibile");
        currentIndex = 0;
      }
      showProfile(currentIndex);
    }

    document.addEventListener("DOMContentLoaded", () => {
      showProfile(currentIndex);

      document.querySelector(".btn-reject").addEventListener("click", nextProfile);
      document.querySelector(".btn-accept").addEventListener("click", nextProfile);

      // Chat open/close
      window.openChat = function() {
        document.getElementById("chat-panel").classList.add("open");
      };
      window.closeChat = function() {
        document.getElementById("chat-panel").classList.remove("open");
      };

      // Invia messaggi base (non salvati in DB)
      function sendMessage() {
        const input = document.getElementById("chat-input");
        const messageText = input.value.trim();
        if (messageText === "") return;
        const messagesContainer = document.querySelector(".chat-messages");
        const message = document.createElement("div");
        message.className = "message sent";
        message.innerHTML = `<strong>Tu:</strong> ${messageText}`;
        messagesContainer.appendChild(message);
        input.value = "";
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      document.querySelector(".send-btn").addEventListener("click", sendMessage);
      document.getElementById("chat-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
      });
    });
  </script>
</body>
</html>
