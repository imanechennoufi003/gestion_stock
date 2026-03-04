<?php
// ============================================================
//  api/auth.php — Authentification (login / register / logout / check)
//  Actions : ?action=login | register | logout | check
// ============================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'check';

switch ($action) {

    // ----------------------------------------------------------
    case 'login':
        $body     = getBody();
        $username = trim($body['username'] ?? '');
        $password = trim($body['password'] ?? '');

        if (!$username || !$password) {
            jsonErr('Nom d\'utilisateur et mot de passe requis.');
        }

        $db   = getDB();
        $stmt = $db->prepare('SELECT * FROM utilisateurs WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password'])) {
            jsonErr('Identifiants incorrects. Vérifiez votre nom d\'utilisateur et mot de passe.', 401);
        }

        // Stocker en session (sans le hash)
        $_SESSION['user'] = [
            'id'       => $user['id'],
            'username' => $user['username'],
            'email'    => $user['email'],
            'role'     => $user['role'],
        ];
        session_regenerate_id(true);

        jsonOk($_SESSION['user'], 'Connexion réussie.');

    // ----------------------------------------------------------
    case 'register':
        $body     = getBody();
        $username = trim($body['username'] ?? '');
        $email    = trim($body['email']    ?? '');
        $password = trim($body['password'] ?? '');

        if (!$username || !$password) {
            jsonErr('Nom d\'utilisateur et mot de passe requis.');
        }
        if (strlen($password) < 4) {
            jsonErr('Le mot de passe doit contenir au moins 4 caractères.');
        }

        $db   = getDB();
        $chk  = $db->prepare('SELECT id FROM utilisateurs WHERE username = ? LIMIT 1');
        $chk->execute([$username]);
        if ($chk->fetch()) {
            jsonErr('Ce nom d\'utilisateur est déjà pris.');
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $ins  = $db->prepare(
            'INSERT INTO utilisateurs (username, email, password, role) VALUES (?, ?, ?, ?)'
        );
        $ins->execute([$username, $email, $hash, 'user']);
        $newId = (int) $db->lastInsertId();

        $_SESSION['user'] = [
            'id'       => $newId,
            'username' => $username,
            'email'    => $email,
            'role'     => 'user',
        ];
        session_regenerate_id(true);

        jsonOk($_SESSION['user'], 'Compte créé avec succès.');

    // ----------------------------------------------------------
    case 'logout':
        $_SESSION = [];
        session_destroy();
        jsonOk(null, 'Déconnecté.');

    // ----------------------------------------------------------
    case 'check':
    default:
        $u = currentUser();
        if ($u) {
            jsonOk($u, 'Session active.');
        } else {
            jsonOk(null, 'Non connecté.');
        }
}
