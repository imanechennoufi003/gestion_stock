<?php
// ============================================================
//  api/orders.php — Commandes (save + list)
//  GET → liste user | POST ?action=add
// ============================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';
$db     = getDB();

switch ($action) {

    case 'list':
    default:
        $user = currentUser();
        if (!$user) jsonErr('Non authentifié', 401);

        $stmt = $db->prepare(
            'SELECT c.*, GROUP_CONCAT(ci.qty, "x", ci.product_name, "@", ci.price ORDER BY ci.id SEPARATOR "||") AS items_str
             FROM commandes c
             LEFT JOIN commande_items ci ON ci.commande_id = c.id
             WHERE c.user_id = ?
             GROUP BY c.id
             ORDER BY c.id DESC
             LIMIT 100'
        );
        $stmt->execute([$user['id']]);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id']       = (int)  $row['id'];
            $row['subtotal'] = (float)$row['subtotal'];
            $row['user_id']  = (int)  $row['user_id'];
            $row['billing']  = $row['billing_json'] ? json_decode($row['billing_json'], true) : null;
            unset($row['billing_json'], $row['items_str']);
        }
        jsonOk($rows);

    case 'add':
        $user = requireAuth();
        $b    = getBody();

        $ticketNo  = trim($b['ticketNo']  ?? '');
        $customer  = trim($b['customer']  ?? $user['username']);
        $subtotal  = (float)($b['subtotal']  ?? 0);
        $tvaRate   = (float)($b['tvaRate']   ?? 0.20);
        $payment   = trim($b['payment']   ?? 'Card');
        $billing   = $b['billing']    ?? [];
        $items     = $b['items']      ?? [];
        $barcode   = trim($b['barcode']   ?? '');

        if (!$ticketNo || empty($items)) jsonErr('Ticket et articles requis.');

        // Vérifier stock avant insertion
        foreach ($items as $it) {
            $pid = (int)($it['id'] ?? 0);
            $qty = (int)($it['qty'] ?? 0);
            if (!$pid || $qty <= 0) continue;

            $row = $db->prepare('SELECT stock, name FROM produits WHERE id = ?');
            $row->execute([$pid]);
            $prod = $row->fetch();
            if ($prod && $prod['stock'] < $qty) {
                jsonErr('Stock insuffisant pour: ' . $prod['name']);
            }
        }

        // Insérer la commande
        $insOrder = $db->prepare(
            'INSERT INTO commandes (ticket_no, user_id, customer, subtotal, tva_rate, payment_mode, billing_json, barcode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insOrder->execute([
            $ticketNo,
            $user['id'],
            $customer,
            $subtotal,
            $tvaRate,
            $payment,
            json_encode($billing, JSON_UNESCAPED_UNICODE),
            $barcode
        ]);
        $orderId = (int)$db->lastInsertId();

        // Insérer les lignes + déduire le stock
        $insItem = $db->prepare(
            'INSERT INTO commande_items (commande_id, product_id, product_name, price, qty) VALUES (?, ?, ?, ?, ?)'
        );
        $updStock = $db->prepare(
            'UPDATE produits SET stock = GREATEST(0, stock - ?) WHERE id = ?'
        );

        foreach ($items as $it) {
            $pid   = (int)  ($it['id']    ?? 0);
            $pname = trim($it['name']   ?? '');
            $price = (float)($it['price'] ?? 0);
            $qty   = (int)  ($it['qty']   ?? 0);

            if (!$pname || $qty <= 0) continue;

            $insItem->execute([$orderId, $pid ?: null, $pname, $price, $qty]);
            if ($pid) $updStock->execute([$qty, $pid]);
        }

        // Vider le panier DB de l'utilisateur
        $db->prepare('DELETE FROM panier WHERE user_id = ?')->execute([$user['id']]);

        jsonOk(['orderId' => $orderId], 'Commande enregistrée.');
}
