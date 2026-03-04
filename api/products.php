<?php
// ============================================================
//  api/products.php — CRUD Produits
//  GET → liste | POST ?action=add | edit | delete
// ============================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';
$db     = getDB();

switch ($action) {

    // ----------------------------------------------------------
    case 'list':
    default:
        $rows = $db->query('SELECT * FROM produits ORDER BY id DESC')->fetchAll();
        // Normalise les types
        foreach ($rows as &$r) {
            $r['id']      = (int)  $r['id'];
            $r['price']   = (float)$r['price'];
            $r['stock']   = (int)  $r['stock'];
            $r['popular'] = (bool) $r['popular'];
        }
        jsonOk($rows);

    // ----------------------------------------------------------
    case 'add':
        requireAuth();
        $b       = getBody();
        $name    = trim($b['name']        ?? '');
        $cat     = strtoupper(trim($b['category']    ?? 'AUTRE'));
        $price   = (float)($b['price']   ?? 0);
        $stock   = (int)  ($b['stock']   ?? 0);
        $desc    = trim($b['description'] ?? $b['desc'] ?? '');
        $img     = trim($b['img_url']     ?? $b['img']  ?? '');
        $popular = (int)(bool)($b['popular'] ?? 0);

        if (!$name) jsonErr('Le nom du produit est requis.');

        $stmt = $db->prepare(
            'INSERT INTO produits (name, category, price, stock, description, img_url, popular)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$name, $cat, $price, $stock, $desc, $img, $popular]);
        $id = (int)$db->lastInsertId();

        jsonOk(['id' => $id, 'name' => $name, 'category' => $cat,
                'price' => $price, 'stock' => $stock,
                'description' => $desc, 'img_url' => $img, 'popular' => (bool)$popular],
               'Produit ajouté.');

    // ----------------------------------------------------------
    case 'edit':
        requireAuth();
        $b    = getBody();
        $id   = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('ID manquant.');

        $name    = trim($b['name']        ?? '');
        $cat     = strtoupper(trim($b['category']    ?? 'AUTRE'));
        $price   = (float)($b['price']   ?? 0);
        $stock   = (int)  ($b['stock']   ?? 0);
        $desc    = trim($b['description'] ?? $b['desc'] ?? '');
        $img     = trim($b['img_url']     ?? $b['img']  ?? '');
        $popular = (int)(bool)($b['popular'] ?? 0);

        if (!$name) jsonErr('Le nom du produit est requis.');

        $stmt = $db->prepare(
            'UPDATE produits SET name=?, category=?, price=?, stock=?, description=?, img_url=?, popular=?
             WHERE id=?'
        );
        $stmt->execute([$name, $cat, $price, $stock, $desc, $img, $popular, $id]);

        jsonOk(null, 'Produit mis à jour.');

    // ----------------------------------------------------------
    case 'delete':
        requireAuth();
        $b  = getBody();
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('ID manquant.');

        $db->prepare('DELETE FROM produits WHERE id = ?')->execute([$id]);
        jsonOk(null, 'Produit supprimé.');

    // ----------------------------------------------------------
    case 'update_stock':
        // Déduit le stock lors d'un paiement (appelé par orders.php en interne)
        requireAuth();
        $b  = getBody();
        $id = (int)($b['id']  ?? 0);
        $qt = (int)($b['qty'] ?? 0);
        if (!$id || $qt <= 0) jsonErr('Paramètres invalides.');

        $stmt = $db->prepare('UPDATE produits SET stock = GREATEST(0, stock - ?) WHERE id = ?');
        $stmt->execute([$qt, $id]);
        jsonOk(null, 'Stock mis à jour.');
}
