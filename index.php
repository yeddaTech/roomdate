<?php
require_once 'db.php';

// Recupera profili utenti dal DB
$stmt = $pdo->query("SELECT id, username, name, description, image_url FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Roomdate</title>
    <link rel="stylesheet" href="css/style.css" />
    <link href="https://fonts.googleapis.com/css2?family=Victor+Mono:wght@400;700&display=swap" rel="stylesheet" />
</head>
<body>
    <header class="app-header">
        <h1 class="app-title">ROOMDATE</h1>
    </header>

    <main class="app-content">
        <div class="profile-card">
            <div class="profile-images" id="profile-image">
                <!-- Immagine profilo caricata da JS -->
            </div>
            <div class="profile-info" id="profile-info" style="margin-top: 1rem; text-align: center;">
                <!-- Nome e descrizione caricati da JS -->
            </div>
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
            <div class="message received">
                <strong>Anna:</strong> Ciao! Come stai?
            </div>
            <div class="message sent">
                <strong>Tu:</strong> Tutto bene, grazie!
            </div>
        </div>
        <div class="chat-input-area">
            <input id="chat-input" type="text" placeholder="Scrivi un messaggio..." aria-label="Messaggio" />
            <button class="send-btn">Invia</button>
        </div>
    </aside>

    <script>
    // Profili dal PHP passati a JS
    const profiles = <?php echo json_encode($users); ?>;
    let currentIndex = 0;

    function showProfile(index) {
        const profileImage = document.getElementById("profile-image");
        const profileInfo = document.getElementById("profile-info");

        if (!profiles[index]) {
            alert("Nessun altro profilo disponibile");
            currentIndex = 0;
            return;
        }

        profileImage.innerHTML = `<img src="${profiles[index].image_url}" alt="${profiles[index].name}" style="width: 100%; height: 100%; border-radius: 10px;">`;
        profileInfo.innerHTML = `<h2>${profiles[index].name}</h2><p>${profiles[index].description}</p>`;
    }

    function nextProfile() {
        currentIndex++;
        if (currentIndex >= profiles.length) currentIndex = 0;
        showProfile(currentIndex);
    }

    document.addEventListener("DOMContentLoaded", () => {
        showProfile(currentIndex);
        document.querySelector(".btn-reject").addEventListener("click", nextProfile);
        document.querySelector(".btn-accept").addEventListener("click", nextProfile);

        // Chat panel
        document.querySelector(".btn-chat").addEventListener("click", openChat);
        document.querySelector(".close-btn").addEventListener("click", closeChat);

        // Send message
        const sendButton = document.querySelector(".send-btn");
        const inputField = document.getElementById("chat-input");

        function sendMessage() {
            const msg = inputField.value.trim();
            if (!msg) return;
            const chatMessages = document.querySelector(".chat-messages");
            const div = document.createElement("div");
            div.className = "message sent";
            div.innerHTML = `<strong>Tu:</strong> ${msg}`;
            chatMessages.appendChild(div);
            inputField.value = "";
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        sendButton.addEventListener("click", sendMessage);
        inputField.addEventListener("keypress", e => {
            if (e.key === "Enter") sendMessage();
        });
    });

    function openChat() {
        const panel = document.getElementById("chat-panel");
        panel.classList.remove("closing");
        panel.classList.add("open");
    }

    function closeChat() {
        const panel = document.getElementById("chat-panel");
        panel.classList.remove("open");
        panel.classList.add("closing");
        setTimeout(() => panel.classList.remove("closing"), 300);
    }
    </script>
</body>
</html>
