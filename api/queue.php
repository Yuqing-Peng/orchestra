<?php
require __DIR__ . '/db.php';

$con = db();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = read_json_body();
    $trackName = $data['trackName'] ?? '';
    $artistName = $data['artistName'] ?? '';
    $trackUri = $data['trackUri'] ?? '';
    $durationMs = (int)($data['durationMs'] ?? 0);
    $addedBy = $data['addedBy'] ?? 'Guest';

    if ($trackName === '' || $artistName === '' || $trackUri === '') {
        respond(['status' => 'error', 'message' => 'Missing required track information'], 400);
    }

    $posResult = $con->query('SELECT COALESCE(MAX(position), -1) + 1 AS nextPos FROM queue');
    $nextPosition = (int)$posResult->fetch_assoc()['nextPos'];

    $stmt = $con->prepare(
        'INSERT INTO queue (track_name, artist_name, track_uri, duration_ms, position, added_by)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('sssiis', $trackName, $artistName, $trackUri, $durationMs, $nextPosition, $addedBy);
    if ($stmt->execute()) {
        respond(['status' => 'success', 'position' => $nextPosition]);
    }
    respond(['status' => 'error', 'message' => 'Failed to add to queue'], 500);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $con->query('SELECT * FROM queue WHERE played = FALSE ORDER BY position ASC');
    if (!$result) {
        respond(['status' => 'error', 'message' => 'Failed to fetch queue'], 500);
    }
    $queue = [];
    while ($track = $result->fetch_assoc()) {
        $queue[] = [
            'trackName' => $track['track_name'],
            'artistName' => $track['artist_name'],
            'trackUri' => $track['track_uri'],
            'durationMs' => (int)$track['duration_ms'],
            'position' => (int)$track['position'],
            'addedBy' => $track['added_by'],
            'addedAt' => $track['added_at'],
        ];
    }
    respond(['status' => 'success', 'data' => $queue]);
}

if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = read_json_body();
    if (!isset($data['position'])) {
        respond(['status' => 'error', 'message' => 'Missing position information'], 400);
    }
    $position = (int)$data['position'];

    $stmt = $con->prepare('UPDATE queue SET played = TRUE WHERE position = ? AND played = FALSE');
    $stmt->bind_param('i', $position);
    if ($stmt->execute()) {
        respond(['status' => 'success']);
    }
    respond(['status' => 'error', 'message' => 'Failed to update track status'], 500);
}

respond(['status' => 'error', 'message' => 'Unsupported HTTP method'], 405);
