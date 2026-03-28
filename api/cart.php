<?php
// ============================================================
//  api/cart.php — Panier persistant par utilisateur
//  GET → panier | POST ?action=sync | clear
// ============================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'get';
$db     = getDB();

switch ($action) {

    case 'get':
    default:
        $user = currentUser();
        if (!$user) { jsonOk([]); break; }

        $stmt = $db->prepare(
            'SELECT p.product_id, p.qty, pr.name, pr.price, pr.img_url, pr.stock
             FROM panier p
             JOIN produits pr ON pr.id = p.product_id
             WHERE p.user_id = ?'
        );
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['product_id'] = (int)  $r['product_id'];
            $r['qty']        = (int)  $r['qty'];
            $r['price']      = (float)$r['price'];
            $r['stock']      = (int)  $r['stock'];
        }
        jsonOk($rows);

    case 'sync':
        $user = requireAuth();
        $b    = getBody();
        $cart = $b['cart'] ?? [];   // [{ productId: int, qty: int }, ...]

        // Supprimer l'ancien panier
        $db->prepare('DELETE FROM panier WHERE user_id = ?')->execute([$user['id']]);

        if (!empty($cart)) {
            $ins = $db->prepare(
                'INSERT INTO panier (user_id, product_id, qty) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE qty = VALUES(qty)'
            );
            foreach ($cart as $item) {
                $pid = (int)($item['productId'] ?? $item['product_id'] ?? 0);
                $qty = (int)($item['qty'] ?? 1);
                if ($pid > 0 && $qty > 0) {
                    $ins->execute([$user['id'], $pid, $qty]);
                }
            }
        }
        jsonOk(null, 'Panier synchronisé.');

    case 'clear':
        $user = requireAuth();
        $db->prepare('DELETE FROM panier WHERE user_id = ?')->execute([$user['id']]);
        jsonOk(null, 'Panier vidé.');
}
