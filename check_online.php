 <?php
// Abilita la visualizzazione degli errori
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Avvia la sessione
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once 'db.php';
require_once 'online_functions.php';

header('Content-Type: application/json');

try {
    if (isset($_SESSION['user_id'])) {
        // Aggiorna lo stato
        updateOnlineStatus($_SESSION['user_id']);
        echo json_encode(['status' => 'online', 'last_activity' => date('Y-m-d H:i:s')]);
    } else {
        echo json_encode(['status' => 'offline']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'General error: ' . $e->getMessage()]);
}
?