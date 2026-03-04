<?php
// ============================================================
//  api/clients.php — CRUD Clients
//  GET → liste | POST ?action=add | edit | delete
// ============================================================
require_once __DIR__ . '/config.php';

$action = $_GET['action'] ?? 'list';
$db     = getDB();

switch ($action) {

    case 'list':
    default:
        $rows = $db->query('SELECT * FROM clients ORDER BY id DESC')->fetchAll();
        foreach ($rows as &$r) $r['id'] = (int)$r['id'];
        jsonOk($rows);

    case 'add':
        requireAuth();
        $b      = getBody();
        $name   = trim($b['name']   ?? '');
        $email  = trim($b['email']  ?? '');
        $phone  = trim($b['phone']  ?? '');
        $city   = trim($b['city']   ?? '');
        $status = in_array($b['status'] ?? '', ['Actif','Inactif']) ? $b['status'] : 'Actif';

        if (!$name) jsonErr('Le nom du client est requis.');

        $stmt = $db->prepare(
            'INSERT INTO clients (name, email, phone, city, status) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$name, $email, $phone, $city, $status]);
        $id = (int)$db->lastInsertId();

        jsonOk(['id' => $id, 'name' => $name, 'email' => $email,
                'phone' => $phone, 'city' => $city, 'status' => $status],
               'Client ajouté.');

    case 'edit':
        requireAuth();
        $b    = getBody();
        $id   = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('ID manquant.');

        $name   = trim($b['name']   ?? '');
        $email  = trim($b['email']  ?? '');
        $phone  = trim($b['phone']  ?? '');
        $city   = trim($b['city']   ?? '');
        $status = in_array($b['status'] ?? '', ['Actif','Inactif']) ? $b['status'] : 'Actif';

        if (!$name) jsonErr('Le nom est requis.');

        $db->prepare('UPDATE clients SET name=?, email=?, phone=?, city=?, status=? WHERE id=?')
           ->execute([$name, $email, $phone, $city, $status, $id]);

        jsonOk(null, 'Client mis à jour.');

    case 'delete':
        requireAuth();
        $b  = getBody();
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('ID manquant.');

        $db->prepare('DELETE FROM clients WHERE id = ?')->execute([$id]);
        jsonOk(null, 'Client supprimé.');
}
