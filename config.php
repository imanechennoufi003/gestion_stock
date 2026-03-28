<?php
// ============================================================
//  config.php — Connexion PDO + helpers partagés
// ============================================================

// --- Paramètres de connexion XAMPP (modifiez si besoin) -----
define('DB_HOST', 'localhost');
define('DB_NAME', 'gestion_stock');
define('DB_USER', 'root');
define('DB_PASS', '');           // Mot de passe MySQL (vide par défaut XAMPP)
define('DB_CHARSET', 'utf8mb4');

// --- Session -----------------------------------------------
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 86400,     // 1 jour
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// --- CORS (autoriser les requêtes depuis le même domaine) ---
$allowedOrigins = ['http://localhost', 'http://127.0.0.1'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Connexion PDO ------------------------------------------
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// --- Réponses JSON ------------------------------------------
function jsonOk(mixed $data = null, string $msg = 'ok'): void {
    echo json_encode(['success' => true,  'msg' => $msg, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonErr(string $msg = 'Erreur', int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'msg' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// --- Récupérer les données POST (JSON ou form) ---------------
function getBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (is_array($data)) return $data;
    return $_POST;
}

// --- Utilisateur connecté ------------------------------------
function currentUser(): ?array {
    return $_SESSION['user'] ?? null;
}

function requireAuth(): array {
    $u = currentUser();
    if (!$u) jsonErr('Non authentifié', 401);
    return $u;
}
