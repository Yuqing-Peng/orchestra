CREATE DATABASE IF NOT EXISTS ostinato CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ostinato;

CREATE TABLE IF NOT EXISTS messages (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    userid      VARCHAR(100) NOT NULL,
    queueid     INT NOT NULL DEFAULT 1,
    content     TEXT NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages_queue (queueid, created_at)
);

CREATE TABLE IF NOT EXISTS queue (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    track_name   VARCHAR(255) NOT NULL,
    artist_name  VARCHAR(255) NOT NULL,
    track_uri    VARCHAR(100) NOT NULL,
    duration_ms  INT NOT NULL DEFAULT 0,
    position     INT NOT NULL,
    added_by     VARCHAR(100) NOT NULL DEFAULT 'Guest',
    added_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    played       BOOLEAN NOT NULL DEFAULT FALSE,
    INDEX idx_queue_played (played, position)
);
