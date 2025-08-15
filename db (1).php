 <?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
// ... resto del codice db.php ...

// Impostazioni per localhost
$host = "sql102.infinityfree.com"; // o "127.0.0.1"
$dbname = "if0_39665147_roomdate"; // nome del DB che hai creato in phpMyAdmin
$username = "if0_39665147";   // utente predefinito di MySQL in locale
$password = "FqgVSlCo0tjjF";       // di solito vuoto in locale (con XAMPP o MAMP)

// Connessione
try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Errore connessione DB: " . $e->getMessage());
}
?>