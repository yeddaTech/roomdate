 <?php
require_once 'db.php';

// Set headers to mimic browser request
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: same-origin');

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Verify user is authenticated
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Non autenticato']);
    exit;
}

$user_id = $_SESSION['user_id'];

// Get action from POST instead of GET to avoid blocking
$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    if ($action === 'send') {
        $receiver_id = intval($_POST['receiver_id'] ?? 0);
        $message = trim($_POST['message'] ?? '');

        if ($receiver_id <= 0 || empty($message)) {
            throw new Exception('Dati mancanti');
        }

        $stmt = $pdo->prepare("INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)");
        $stmt->execute([$user_id, $receiver_id, htmlspecialchars($message, ENT_QUOTES)]);

        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'fetch') {
        $other_id = intval($_GET['other_id'] ?? $_POST['other_id'] ?? 0);
        if ($other_id <= 0) {
            throw new Exception('ID utente mancante');
        }

        $stmt = $pdo->prepare("
            SELECT m.*, u.name as sender_name 
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) 
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC
        ");
        $stmt->execute([$user_id, $other_id, $other_id, $user_id]);
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['messages' => $messages]);
        exit;
    }

    if ($action === 'conversations') {
        $stmt = $pdo->prepare("
            SELECT u.id, u.name, u.image_url, MAX(m.created_at) AS last_message_time,
                   (SELECT message FROM messages 
                    WHERE ((sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id))
                    ORDER BY created_at DESC LIMIT 1) AS last_message
            FROM users u
            JOIN messages m ON (
                (m.sender_id = u.id AND m.receiver_id = ?)
                OR
                (m.receiver_id = u.id AND m.sender_id = ?)
            )
            WHERE u.id != ?
            GROUP BY u.id, u.name, u.image_url
            ORDER BY last_message_time DESC
        ");
        $stmt->execute([$user_id, $user_id, $user_id, $user_id, $user_id]);
        $conversations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['conversations' => $conversations]);
        exit;
    }

    throw new Exception('Azione non valida');

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
