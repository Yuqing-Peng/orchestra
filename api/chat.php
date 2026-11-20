<?php
require __DIR__ . '/db.php';

$con = db();
$queueId = 1;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = read_json_body();
    $userid = trim((string)($data['userid'] ?? ''));
    $content = trim((string)($data['content'] ?? ''));

    if ($userid === '' || $content === '') {
        respond(['status' => 'error', 'message' => 'User ID and message content cannot be empty!'], 400);
    }
    if (mb_strlen($content) > 500) {
        respond(['status' => 'error', 'message' => 'Message is too long (max 500 characters)'], 400);
    }

    $stmt = $con->prepare('INSERT INTO messages (userid, queueid, content, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->bind_param('sis', $userid, $queueId, $content);
    if ($stmt->execute()) {
        respond(['status' => 'success']);
    }
    respond(['status' => 'error', 'message' => 'Failed to post message'], 500);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $con->prepare(
        'SELECT * FROM (
            SELECT id, userid, content, created_at FROM messages
            WHERE queueid = ? ORDER BY created_at DESC, id DESC LIMIT 100
         ) recent ORDER BY created_at ASC, id ASC'
    );
    $stmt->bind_param('i', $queueId);
    if (!$stmt->execute()) {
        respond(['status' => 'error', 'message' => 'Failed to fetch messages'], 500);
    }
    $result = $stmt->get_result();
    $messages = [];
    while ($msg = $result->fetch_assoc()) {
        $messages[] = [
            'id' => (int)$msg['id'],
            'userId' => $msg['userid'],
            'message' => $msg['content'],
            'timestamp' => $msg['created_at'],
        ];
    }
    respond(['status' => 'success', 'data' => $messages]);
}

respond(['status' => 'error', 'message' => 'Unsupported HTTP method'], 405);
