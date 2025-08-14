 <?php
require_once 'db.php';
require_once 'online_functions.php';
session_start();

if (isset($_SESSION['user_id'])) {
    // Forza l'aggiornamento dello stato
    $pdo->prepare("UPDATE users SET 
                  is_online = TRUE,
                  last_activity = NOW()
                  WHERE id = ?")->execute([$_SESSION['user_id']]);
}
?