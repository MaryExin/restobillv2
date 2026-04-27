<?php
declare (strict_types = 1);

require __DIR__ . "/bootstrap.php";

$corsPolicy = new CorsPolicy();
$corsPolicy->cors();

// Secure API Key
$openai_api_key = $_ENV["OPENAI_API_KEY"];
if (!$openai_api_key) {
    echo json_encode(["error" => "Missing OpenAI API Key"]);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents("php://input"), true);

// Validate input
if (!isset($input['messages'])) {
    echo json_encode(["error" => "Missing 'messages' field"]);
    exit;
}

// Prepare OpenAI API request
$url = "https://api.openai.com/v1/chat/completions";
$data = [
    "model" => "gpt-4o-mini",
    "messages" => $input['messages']
];

$maxRetries = 3;
$retryDelay = 2;
$response = false;

for ($i = 0; $i < $maxRetries; $i++) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "Authorization: Bearer $openai_api_key"
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HEADER, true); // Include headers in response

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $header = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    
    curl_close($ch);

    // Extract Retry-After header manually
    $retryAfter = 0;
    if (preg_match('/Retry-After: (\d+)/', $header, $matches)) {
        $retryAfter = (int) $matches[1];
    }

    if ($httpCode == 200) {
        echo $body;
        exit;
    } elseif ($httpCode == 429) {
        // Wait for the Retry-After time or use exponential backoff
        sleep($retryAfter > 0 ? $retryAfter : $retryDelay);
        $retryDelay *= 2; // Increase delay for next retry
    } else {
        break; // Stop retrying if it's another error
    }
}

// Final error response if all retries fail
echo json_encode(["error" => "OpenAI request failed after retries"]);
?>
