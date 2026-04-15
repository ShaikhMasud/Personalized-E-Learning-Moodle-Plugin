<?php
// local/automation/chatbot_endpoint.php
require_once(__DIR__ . '/../../config.php');
require_login();
require_sesskey();

header('Content-Type: application/json; charset=utf-8');

// Get parameters
$prompt = required_param('prompt', PARAM_RAW);
$mode = optional_param('mode', 'assistant', PARAM_ALPHA);

// Retrieve API key from plugin settings
$apiKey = get_config('local_automation', 'groq_api_key');
if (!$apiKey) {
    echo json_encode(['error' => 'Groq API key not configured in admin settings.']);
    exit;
}

// Define system prompts based on mode
$systemPrompts = [
    'assistant' => 'You are a Moodle Automation AI.
You are a Moodle AI assistant that can both chat normally and perform automations.

Your behaviour has two modes:

1. AUTOMATION MODE
If the user is requesting a Moodle action (like creating a course, generating quizzes, enrolling users, etc.), return STRICT JSON only.

Rules for automation responses:
- Output STRICT JSON only.
- No explanations outside JSON.
- Identify operation using "type".
- Extract only the parameters needed.
- If required parameters are missing, return:

{
 "type": "<operation>_missing_params",
 "missing": ["param1","param2"]
}

Do NOT invent missing values.

---------------------------------------
FEATURE: COURSE CREATION
---------------------------------------

Mandatory params:
- fullname
- shortname (auto-generate if missing: short, relevant, uppercase)
- category = "1" (hardcoded)
- numsections (integer > 0)
- sections (array of strings, length == numsections)

SECTION RULES:
- If user gives a number of sections (e.g. "4 sections") → set "numsections" to that number.
- If user also gives names for some sections (e.g. first = "Graphs", second = "Trees"),
  then "sections" must include ALL section names. Use the given ones and auto-fill the rest.
- If user only gives number, no names → generate default section names.

Example output:

{
 "type": "course_creation",
 "params": {
   "fullname": "Data Structures",
   "shortname": "DS",
   "category": "1",
   "numsections": 4,
   "sections": ["Section 1","Section 2","Section 3","Section 4"]
 }
}

---------------------------------------

2. CHAT MODE
If the user is asking a general question, greeting, or conversation not related to automation, respond normally in plain text like a helpful Moodle assistant.

Examples:
User: "hello"
Assistant: "Hello! How can I help you with Moodle today?"

User: "How do I create a course?"
Assistant: Explain normally.

IMPORTANT:
- Only output JSON when an automation is detected.
- Otherwise respond with plain text.
- Do NOT wrap JSON in markdown blocks.',

    'qb' => 'You are a question bank generator. Given a topic, create relevant questions, answers, and explanations.',

    'quiz' => 'You generate multiple-choice quiz questions for classroom assessments. 
Return questions in this exact format:
Q1. <question text>
a) <option A>
b) <option B>
c) <option C>
d) <option D>
Correct answer: <letter>

Do not include explanations or extra text.
Ensure each question and option are on separate lines.'
];


$systemPrompt = $systemPrompts[$mode] ?? $systemPrompts['assistant'];

// Prepare API payload
$payload = [
    // 'model' => 'llama-3.1-8b-instant',
    'model' => (get_config('local_automation', 'groq_model') ?: 'llama-3.1-8b-instant'),
    'messages' => [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user', 'content' => $prompt]
    ]
];

$url = 'https://api.groq.com/openai/v1/chat/completions';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer {$apiKey}",
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

// Execute
$response = curl_exec($ch);
$curlerr = curl_error($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false || $curlerr) {
    echo json_encode(['error' => 'Failed to reach Groq API: ' . $curlerr, 'http_code' => $httpcode]);
    exit;
}

// Parse returned JSON
$grok = json_decode($response, true);

// Pull assistant content (fallback robust)
$assistantText = null;
if (!empty($grok['choices'][0]['message']['content'])) {
    $assistantText = $grok['choices'][0]['message']['content'];
} else {
    // if Groq returned an error structure
    if (!empty($grok['error']['message'])) {
        echo json_encode(['error' => 'Groq error: ' . $grok['error']['message']]);
        exit;
    }
    // fallback: return raw response
    echo json_encode(['error' => 'Invalid response from Groq API.', 'details' => $grok]);
    exit;
}

// Try to parse assistantText as JSON (assistant mode uses strict JSON)
$maybejson = json_decode($assistantText, true);
if ($maybejson !== null && isset($maybejson['type'])) {
    // Structured automation response (return as JSON to front-end)
    echo json_encode(['automation' => true, 'data' => $maybejson]);
    exit;
}

// Non-automation fallback: return plaintext reply
echo json_encode(['reply' => $assistantText]);
exit;

// Make request to Groq API
// $url = 'https://api.groq.com/openai/v1/chat/completions';
// $context = stream_context_create([
//     'http' => [
//         'method'  => 'POST',
//         'header'  => "Content-Type: application/json\r\n" .
//                      "Authorization: Bearer {$apiKey}\r\n",
//         'content' => json_encode($payload),
//         'ignore_errors' => true
//     ]
// ]);

// $response = file_get_contents($url, false, $context);
// if ($response === false) {
//     echo json_encode(['error' => 'Failed to reach Groq API endpoint.']);
//     exit;
// }

// $data = json_decode($response, true);
// if (isset($data['choices'][0]['message']['content'])) {
//     echo json_encode(['reply' => $data['choices'][0]['message']['content']]);
// } else {
//     echo json_encode(['error' => 'Invalid response from Groq API.', 'details' => $data]);
// }
