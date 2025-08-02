<?php
// Connessione al DB PostgreSQL usando variabile d'ambiente DATABASE_URL (Railway)
$databaseUrl = getenv('DATABASE_URL') ?: 'postgresql://postgres:cYWTATzQreoIWRzzuUxLbfIltqSxfkqt@postgres.railway.internal:5432/railway';

if (!$databaseUrl) {
    die("Errore: variabile d'ambiente DATABASE_URL non trovata.");
}

$dbopts = parse_url($databaseUrl);

$host = $dbopts["host"];
$port = $dbopts["port"];
$user = $dbopts["user"];
$password = $dbopts["pass"];
$dbname = ltrim($dbopts["path"],'/');

try {
    $pdo = new PDO("pgsql:host=$host;port=$port;dbname=$dbname", $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Errore connessione DB: " . $e->getMessage());
}
