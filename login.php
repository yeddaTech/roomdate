 <?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once 'db.php';
require_once 'online_functions.php';

// Verifica se l'utente è già loggato
if (isset($_SESSION['user_id'])) {
    header("Location: index.php");
    exit;
}

$error = "";
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = trim($_POST['password'] ?? '');

    if ($email && $password) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user && hash('sha256', $password) === $user['password']) {
             // Dopo il login riuscito
$_SESSION['user_id'] = $user['id'];
$_SESSION['user_name'] = $user['name'];
updateOnlineStatus($user['id']); // Imposta subito online
header("Location: index.php");
exit;
            } else {
                $error = "Email o password errati.";
            }
        } catch (PDOException $e) {
            $error = "Errore del database: " . $e->getMessage();
        }
    } else {
        $error = "Compila tutti i campi.";
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login - Roomdate</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body class="login-page">
  <div class="login-container">
    <h2>Accedi a Roomdate</h2>

    <?php if ($error): ?>
      <div class="error-msg"><?php echo htmlspecialchars($error); ?></div>
    <?php endif; ?>

    <form method="post" action="login.php">
      <input type="email" name="email" placeholder="Email" required />
      <input type="password" name="password" placeholder="Password" required />
      <button type="submit">Entra</button>
    </form>

    <p class="switch-auth">
      Non hai un account? <a href="register.php">Registrati</a>
    </p>
  </div>
</body>
</html