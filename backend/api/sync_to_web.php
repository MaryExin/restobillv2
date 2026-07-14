<?php
$config = require 'config.php';
try {
    $dsn = "mysql:host={$config['host']};dbname={$config['db']};charset={$config['charset']}";
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    $stmt = $pdo->query("SELECT * FROM tbl_sync_queue WHERE sync_status = 'Pending' LIMIT 10");
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as $item) {
        
        $web_api_url = "https://iyong-website.com/api/receiver.php";
        
        $ch = curl_init($web_api_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($item));
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $res = curl_exec($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http == 200) {
            $pdo->prepare("UPDATE tbl_sync_queue SET sync_status = 'Completed' WHERE sync_id = ?")->execute([$item['sync_id']]);
        }
    }
} catch (Exception $e) { /* silent error */ }