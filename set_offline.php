 <?php
require_once 'db.php';
session_start();

if(isset($_SESSION['user_id'])) {
    $stmt = $pdo->prepare("UPDATE users 
                          SET is_online = FALSE, 
                              chat_status = 'offline'
                          WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    
    // Registra il logout nel log attività
    $pdo->prepare("INSERT INTO user_activity 
                  (user_id, activity_time, activity_type) 
                  VALUES (?, NOW(), 'logout')")
       ->execute([$_SESSION['user_id']]);
}
?