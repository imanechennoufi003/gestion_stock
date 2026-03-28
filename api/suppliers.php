<?php
// ============================================================
//  api/suppliers.php — CRUD Fournisseurs
//  GET → liste | POST ?action=add | edit | delete
// ============================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';
$db     = getDB();

switch ($action) {

    case 'list':
    default:
        $rows = $db->query('SELECT * FROM fournisseurs ORDER BY id DESC')->fetchAll();
        foreach ($rows as &$r) $r['id'] = (int)$r['id'];
        jsonOk($rows);

    case 'add':
        requireAuth();
        $b       = getBody();
        $name    = trim($b['name']    ?? '');
        $cat     = strtoupper(trim($b['category'] ?? ''));
        $contact = trim($b['contact'] ?? '');
        $phone   = trim($b['phone']   ?? '');

        if (!$name) jsonErr('Le nom du fournisseur est requis.');

        $stmt = $db->prepare(
            'INSERT INTO fournisseurs (name, category, contact, phone) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$name, $cat, $contact, $phone]);
        $id = (int)$db->lastInsertId();

        jsonOk(['id' => $id, 'name' => $name, 'category' => $cat,
                'contact' => $contact, 'phone' => $phone],
               'Fournisseur ajouté.');

    case 'edit':
        requireAuth();
        $b  = getBody();
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('ID manquant.');

        $name    = trim($b['name']    ?? '');
        $cat     = strtoupper(trim($b['category'] ?? ''));
        $contact = trim($b['contact'] ?? '');
        $phone   = trim($b['phone']   ?? '');

        if (!$name) jsonErr('Le nom est requis.');

        $db->prepare('UPDATE fournisseurs SET name=?, category=?, contact=?, phone=? WHERE id=?')
           ->execute([$name, $cat, $contact, $phone, $id]);

        jsonOk(null, 'Fournisseur mis à jour.');

    case 'delete':
        requireAuth();
        $b  = getBody();
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('ID manquant.');

        $db->prepare('DELETE FROM fournisseurs WHERE id = ?')->execute([$id]);
        jsonOk(null, 'Fournisseur supprimé.');
}
