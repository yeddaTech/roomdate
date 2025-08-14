 <?php
require_once 'db.php';
session_start();

if (!isset($_SESSION['user_id'])) {
    header("Location: login.php");
    exit;
}

$error = "";
$success = "";

// Recupera i dati attuali dell'utente
$stmt = $pdo->prepare("SELECT name, email, description, image_url, gender FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $gender = trim($_POST['gender'] ?? '');

    // Mantiene immagine attuale se non caricata nuova
    $imagePath = $user['image_url'];

    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'images/uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        $tmpName = $_FILES['image']['tmp_name'];
        $originalName = basename($_FILES['image']['name']);
        $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'];

        if (in_array($extension, $allowedExtensions)) {
            $newFileName = uniqid('img_', true) . '.' . $extension;
            $destination = $uploadDir . $newFileName;
            if (move_uploaded_file($tmpName, $destination)) {
                $imagePath = $destination;
            } else {
                $error = "Errore durante il caricamento dell'immagine.";
            }
        } else {
            $error = "Formato immagine non valido.";
        }
    }

    if (empty($error)) {
        $stmt = $pdo->prepare("UPDATE users SET name=?, description=?, image_url=?, gender=? WHERE id=?");
        $stmt->execute([$name, $description, $imagePath, $gender, $_SESSION['user_id']]);
        $success = "Profilo aggiornato con successo!";
        // Aggiorna dati utente
        $user['name'] = $name;
        $user['description'] = $description;
        $user['image_url'] = $imagePath;
        $user['gender'] = $gender;
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Modifica Profilo - Roomdate</title>
    <link rel="stylesheet" href="css/style.css" />
    <style>
        .profile-container { max-width: 500px; margin: auto; padding: 20px; }
        .profile-container img { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; }
        .gender-selection { display: flex; gap: 10px; margin-bottom: 15px; }
        .gender-btn { flex: 1; padding: 10px; text-align: center; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
        .gender-btn.selected { background: #4CAF50; color: white; border-color: #4CAF50; }
        .gender-btn input { display: none; }
        textarea { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; min-height: 80px; margin-bottom: 15px; }
    </style>
</head>
<body>
<div class="profile-container">
    <h2>Modifica il tuo profilo</h2>
    <?php if ($error): ?><div class="error-msg"><?= htmlspecialchars($error) ?></div><?php endif; ?>
    <?php if ($success): ?><div class="success-msg"><?= htmlspecialchars($success) ?></div><?php endif; ?>

    <form method="POST" enctype="multipart/form-data">
        <div style="text-align:center;">
            <img src="<?= htmlspecialchars($user['image_url']) ?>" alt="Immagine Profilo">
        </div>
        <input type="text" name="name" placeholder="Nome" value="<?= htmlspecialchars($user['name']) ?>" required />
        
        <div class="gender-selection">
            <label class="gender-btn <?= ($user['gender'] ?? '') === 'M' ? 'selected' : '' ?>">
                <input type="radio" name="gender" value="M" <?= ($user['gender'] ?? '') === 'M' ? 'checked' : '' ?>> Uomo
            </label>
            <label class="gender-btn <?= ($user['gender'] ?? '') === 'F' ? 'selected' : '' ?>">
                <input type="radio" name="gender" value="F" <?= ($user['gender'] ?? '') === 'F' ? 'checked' : '' ?>> Donna
            </label>
        </div>

        <textarea name="description" placeholder="Scrivi una breve descrizione di te..."><?= htmlspecialchars($user['description'] ?? '') ?></textarea>
        
        <input type="file" name="image" accept="image/*" />
        <button type="submit">Salva modifiche</button>
    </form>
    <p><a href="index.php">⬅ Torna alla Home</a></p>
</div>

<script>
    // Evidenzia il bottone del sesso selezionato
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input').checked = true;
        });
    });
</script>
</body>
</html>