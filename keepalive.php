 <?php
require_once 'db.php';
require_once 'online_functions.php';
session_start();

if (isset($_SESSION['user_id'])) {
    updateOnlineStatus($_SESSION['user_id']);
    echo "OK";
    updateOnlineStatus($_SESSION['user_id']);
} else {
    http_response_code(401);
}
?