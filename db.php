 <?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
// ... resto del codice db.php ...

// Impostazioni per localhost
$host = "mysql.railway.internal"; // o "127.0.0.1"
$dbname = "railway"; // nome del DB che hai creato in phpMyAdmin
$username = "root";   // utente predefinito di MySQL in locale
$password = "VRGDqDxfpHZstDXnYFwZtTtIwnrxvQOy";       // di solito vuoto in locale (con XAMPP o MAMP)

// Connessione
try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Errore connessione DB: " . $e->getMessage());
}
?>
