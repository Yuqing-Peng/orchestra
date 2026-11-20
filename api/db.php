<?php

header('Content-Type: application/json');

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body);
    exit();
}

function read_json_body(): array
{
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function db(): mysqli
{
    $configFile = __DIR__ . '/config.php';
    if (!file_exists($configFile)) {
        respond(['status' => 'error', 'message' => 'Missing api/config.php (copy config.example.php)'], 500);
    }
    $cfg = require $configFile;

    mysqli_report(MYSQLI_REPORT_OFF);
    $con = new mysqli($cfg['host'], $cfg['user'], $cfg['password'], $cfg['database']);
    if ($con->connect_error) {
        respond(['status' => 'error', 'message' => 'Failed to connect to MySQL'], 500);
    }
    $con->set_charset('utf8mb4');
    return $con;
}
