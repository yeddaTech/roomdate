<?php
require_once 'db.php';

try {
    $sql = "
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS likes;
    DROP TABLE IF EXISTS users;

    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100),
      description TEXT,
      image_url TEXT
    );

    CREATE TABLE likes (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      liked_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, liked_user_id)
    );

    CREATE TABLE messages (
      id SERIAL PRIMARY KEY,
      sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO users (username, password_hash, name, description, image_url) VALUES
    ('luca', crypt('password123', gen_salt('bf')), 'Luca', 'Ama cucinare e tenere tutto in ordine.', 'img/luca.jpg'),
    ('sofia', crypt('password123', gen_salt('bf')), 'Sofia', 'Vive con un gatto, ordinata.', 'img/sofia.jpg'),
    ('marco', crypt('password123', gen_salt('bf')), 'Marco', 'Smart worker, silenzioso.', 'img/marco.jpg');
    ";

    $pdo->exec($sql);
    echo "Tabelle create con successo e dati inseriti.";

} catch (PDOException $e) {
    die("Errore durante la creazione delle tabelle: " . $e->getMessage());
}
