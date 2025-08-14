 <?php
require_once 'db.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'error' => 'Non loggato']);
    exit;
}

$user_id = (int)$_SESSION['user_id'];

$data = json_decode(file_get_contents('php://input'), true);
if (!$data || !isset($data['target_id'], $data['action'])) {
    echo json_encode(['success' => false, 'error' => 'Dati mancanti']);
    exit;
}

$target_id = (int)$data['target_id'];
$action = $data['action'];

if (!in_array($action, ['like', 'dislike'])) {
    echo json_encode(['success' => false, 'error' => 'Azione non valida']);
    exit;
}

try {
    $stmt = $pdo->prepare("INSERT INTO interactions (user_id, target_id, action, created_at) VALUES (?, ?, ?, NOW())");
    $stmt->execute([$user_id, $target_id, $action]);
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}