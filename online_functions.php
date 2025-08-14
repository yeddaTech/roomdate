 <?php
function updateOnlineStatus($userId) {
    global $pdo;
    
    $pdo->prepare("UPDATE users 
                  SET last_activity = NOW(),
                      is_online = TRUE,
                      chat_status = 'online'
                  WHERE id = ?")
       ->execute([$userId]);
    
    cleanInactiveUsers();
}

function cleanInactiveUsers() {
    global $pdo;
    $pdo->prepare("UPDATE users 
                  SET is_online = FALSE,
                      chat_status = 'offline'
                  WHERE last_activity < NOW() - INTERVAL 2 MINUTE")
       ->execute();
}

function setOfflineStatus($userId) {
    global $pdo;
    $pdo->prepare("UPDATE users 
                  SET is_online = FALSE,
                      chat_status = 'offline'
                  WHERE id = ?")
       ->execute([$userId]);
}

function getOnlineUsers() {
    global $pdo;
    cleanInactiveUsers();
    
    $stmt = $pdo->prepare("SELECT id, name, chat_status 
                          FROM users 
                          WHERE is_online = TRUE");
    $stmt->execute();
    return $stmt->fetchAll();
}
?