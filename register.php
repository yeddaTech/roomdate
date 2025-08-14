 <?php
require_once 'db.php';

if (isset($_SESSION['user_id'])) {
    header("Location: index.php");
    exit;
}

$error = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = trim($_POST['password'] ?? '');
    $gender = trim($_POST['gender'] ?? '');
    $description = trim($_POST['description'] ?? 'Ciao! Sono nuovo su Roomdate.');

    // Percorso di default
    $imagePath = "images/default.png";

    if ($name && $email && $password && $gender) {
        // Verifica se l'email è già registrata
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            $error = "Email già registrata.";
        } else {
            // Gestione immagine
            if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = 'images/uploads/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }

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
                    $error = "Formato immagine non valido. Sono accettati: jpg, jpeg, png, gif.";
                }
            } else {
                $error = "Devi caricare una foto del profilo.";
            }

            // Solo se non ci sono errori immagine
            if (empty($error)) {
                $hashedPassword = hash('sha256', $password);
                $stmt = $pdo->prepare("INSERT INTO users (name, email, password, description, image_url, gender) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $name,
                    $email,
                    $hashedPassword,
                    $description,
                    $imagePath,
                    $gender
                ]);
                header("Location: login.php");
                exit;
            }
        }
    } else {
        $error = "Compila tutti i campi obbligatori.";
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Registrati - Roomdate</title>
    <link rel="stylesheet" href="css/style.css" />
    <style>
        .gender-selection {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        .gender-btn {
            flex: 1;
            padding: 10px;
            text-align: center;
            background: #f0f0f0;
            border: 1px solid #ccc;
            border-radius: 4px;
            cursor: pointer;
        }
        .gender-btn.selected {
            background: #4CAF50;
            color: white;
            border-color: #4CAF50;
        }
        .gender-btn input {
            display: none;
        }
        textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            resize: vertical;
            min-height: 80px;
            margin-bottom: 15px;
        }
    </style>
</head>
<body class="auth-page">
<div class="register-container">
    <h1>Roomdate</h1>
    <form method="POST" enctype="multipart/form-data" class="auth-form">
        <h2>Registrati</h2>
        <?php if ($error): ?>
            <div class="error-msg"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <input type="text" name="name" placeholder="Nome" required autocomplete="name" />
        <input type="email" name="email" placeholder="Email" required autocomplete="email" />
        <input type="password" name="password" placeholder="Password" required autocomplete="new-password" />
        
        <div class="gender-selection">
            <label class="gender-btn <?= ($_POST['gender'] ?? '') === 'M' ? 'selected' : '' ?>">
                <input type="radio" name="gender" value="M" <?= ($_POST['gender'] ?? '') === 'M' ? 'checked' : '' ?> required> Uomo
            </label>
            <label class="gender-btn <?= ($_POST['gender'] ?? '') === 'F' ? 'selected' : '' ?>">
                <input type="radio" name="gender" value="F" <?= ($_POST['gender'] ?? '') === 'F' ? 'checked' : '' ?>> Donna
            </label>
        </div>
        
        <textarea name="description" placeholder="Scrivi una breve descrizione di te..."><?= htmlspecialchars($_POST['description'] ?? '') ?></textarea>
        
        <input type="file" name="image" accept="image/*" required />
        <button type="submit">Registrati</button>
        <p class="switch-auth">Hai già un account? <a href="login.php">Accedi</a></p>
    </form>
</div>

<script>
    // Aggiunge la classe selected al bottone del sesso selezionato
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input').checked = true;
        });
    });
</script>
</body>
</html