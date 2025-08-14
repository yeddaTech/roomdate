 <?php
require_once 'db.php';
session_start();

if (!empty($_SESSION['user_id'])) {
    $stmt = $pdo->prepare("UPDATE users SET is_online = FALSE WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
}

session_destroy();

if (!headers_sent()) {
    header("Location: login.php");
    exit;
} else {
    echo "Errore: headers già inviati, impossibile fare redirect.";
}