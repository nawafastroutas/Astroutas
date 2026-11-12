<?php
/**
 * دُرمان — خادم الدفع الإلكتروني (Paymob عُمان) بملف PHP واحد.
 *
 * ارفع هذا الملف بجانب index.html على نفس الاستضافة، واملأ المفاتيح أدناه.
 * المفاتيح آمنة هنا: المتصفح لا يرى شيفرة PHP إطلاقاً، بعكس index.html.
 *
 * المسارات (تعمل بالشكلين):
 *   pay.php/health   أو  pay.php?action=health   فحص الإعدادات
 *   pay.php/create   أو  pay.php?action=create   إنشاء عملية دفع
 *   pay.php/webhook  أو  pay.php?action=webhook  تأكيد بايموب
 *
 * في لوحة إدارة الموقع ضع الرابط: https://subbha.com/pay.php
 */

// ======================= الإعدادات =======================
$CONFIG = [
    // من لوحة بايموب: Settings ← API Keys  (احرص أن تكون في نفس الوضع Test/Live)
    'PAYMOB_SECRET_KEY'   => '',   // omn_sk_test_... أو omn_sk_live_...
    'PAYMOB_PUBLIC_KEY'   => '',   // omn_pk_test_... أو omn_pk_live_...
    'PAYMOB_HMAC_SECRET'  => '',   // HMAC Secret
    // من لوحة بايموب: Settings ← Payment Integrations (أرقام مفصولة بفاصلة)
    'PAYMOB_INTEGRATION_IDS' => '',   // مثال: 12345,67890

    'SITE_URL' => 'https://subbha.com',

    // Firebase: نفس القيم الموجودة في index.html
    'FIREBASE_DATABASE_URL'  => 'https://ubhha-dd0e9-default-rtdb.firebaseio.com',
    'FIREBASE_API_KEY'       => 'AIzaSyC9LRDGZgxWjFKfop7nS7K4Y9cocMkM7EU',
    'FIREBASE_DATABASE_SECRET' => '', // اختياري؛ أقوى من الجلسة المجهولة

    // الريال العُماني = 1000 بيسة. لا تغيّرها إلا لعملة أخرى.
    'AMOUNT_MULTIPLIER' => 1000,

    'PAYMOB_BASE_URL'     => 'https://oman.paymob.com',
    'PAYMOB_CHECKOUT_URL' => 'https://om.checkout.paymob.com/',
];
// ===================== نهاية الإعدادات =====================

// تسمح بالاستدعاء من نفس الموقع (ومن أي أصل، فالمسارات لا تكشف أسراراً)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: content-type');
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

/** ترتيب الحقول الذي تحدده بايموب لحساب التوقيع. لا تغيّره. */
const HMAC_KEYS = [
    'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
    'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
    'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type',
    'source_data.type', 'success',
];

function out($data, $status = 200) { http_response_code($status); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

function cfg($key, $default = '') {
    global $CONFIG;
    $v = getenv($key);                       // متغيّر بيئة يتفوّق على الملف إن وُجد
    if ($v === false || $v === '') $v = $CONFIG[$key] ?? $default;
    return $v;
}

function multiplier() { $n = (int) cfg('AMOUNT_MULTIPLIER', 1000); return $n > 0 ? $n : 1000; }

function integrationIds() {
    $ids = preg_split('/[,\s]+/', (string) cfg('PAYMOB_INTEGRATION_IDS'), -1, PREG_SPLIT_NO_EMPTY);
    return array_values(array_filter(array_map('intval', $ids), fn($n) => $n > 0));
}

/** عنوان هذا الملف نفسه، لنبني منه رابط إشعار بايموب. */
function selfUrl() {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? parse_url((string) cfg('SITE_URL'), PHP_URL_HOST);
    $path = strtok((string) ($_SERVER['SCRIPT_NAME'] ?? '/pay.php'), '?');
    return ($https ? 'https' : 'http') . '://' . $host . $path;
}

function pick($arr, $path) {
    foreach (explode('.', $path) as $k) {
        if (!is_array($arr) || !array_key_exists($k, $arr)) return null;
        $arr = $arr[$k];
    }
    return $arr;
}

/** القيم كما تكتبها بايموب في JSON: true/false بحروف صغيرة. */
function hmacValue($v) {
    if ($v === null) return '';
    if (is_bool($v)) return $v ? 'true' : 'false';
    return (string) $v;
}

function hmacString($obj) {
    $parts = [];
    foreach (HMAC_KEYS as $k) $parts[] = hmacValue(pick($obj, $k));
    return implode('', $parts);
}

function httpJson($method, $url, $body = null, $headers = []) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => array_merge(['Content-Type: application/json'], $headers),
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) return [0, ['error' => $err]];
    $json = json_decode($raw, true);
    return [$code, is_array($json) ? $json : ['raw' => substr((string) $raw, 0, 300)]];
}

function cleanText($v, $max = 120) {
    $s = trim(preg_replace('/\s+/u', ' ', (string) $v));
    return mb_substr($s, 0, $max);
}

function omanPhone($raw) {
    $d = preg_replace('/\D/', '', (string) $raw);
    if (strlen($d) === 8) return '+968' . $d;
    if (strlen($d) === 11 && str_starts_with($d, '968')) return '+' . $d;
    return $d === '' ? '' : '+' . $d;
}

/* ----------------------------------------------------------- Firebase */
function firebaseToken() {
    static $cached = null;
    $secret = (string) cfg('FIREBASE_DATABASE_SECRET');
    if ($secret !== '') return $secret;
    if ($cached !== null) return $cached;
    $key = (string) cfg('FIREBASE_API_KEY');
    if ($key === '') throw new RuntimeException('FIREBASE_API_KEY غير مضبوط');
    // جلسة مجهولة مثل جلسة العميل في الموقع
    [$code, $data] = httpJson('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' . urlencode($key), ['returnSecureToken' => true]);
    if ($code !== 200 || empty($data['idToken'])) throw new RuntimeException('تعذر الحصول على جلسة Firebase');
    return $cached = $data['idToken'];
}

function firebasePatch($path, $data) {
    $base = rtrim((string) cfg('FIREBASE_DATABASE_URL'), '/');
    if ($base === '') throw new RuntimeException('FIREBASE_DATABASE_URL غير مضبوط');
    $url = $base . '/' . $path . '.json?auth=' . urlencode(firebaseToken());
    [$code, $res] = httpJson('PATCH', $url, $data);
    if ($code < 200 || $code >= 300) throw new RuntimeException('Firebase ' . $code);
    return $res;
}

/* ------------------------------------------------------------- health */
function actionHealth() {
    $key = (string) cfg('PAYMOB_SECRET_KEY');
    $items = [
        'المفتاح السري (Secret Key)'   => $key !== '',
        'المفتاح العام (Public Key)'   => cfg('PAYMOB_PUBLIC_KEY') !== '',
        'مفتاح التوقيع (HMAC Secret)'  => cfg('PAYMOB_HMAC_SECRET') !== '',
        'أرقام التكامل (Integration IDs)' => count(integrationIds()) > 0,
        'رابط الموقع (SITE_URL)'       => cfg('SITE_URL') !== '',
        'قاعدة البيانات (Firebase)'    => cfg('FIREBASE_DATABASE_URL') !== '' && (cfg('FIREBASE_API_KEY') !== '' || cfg('FIREBASE_DATABASE_SECRET') !== ''),
    ];
    // عند الفتح من المتصفح نعرض صفحة عربية مقروءة بدل JSON
    if (str_contains(strtolower($_SERVER['HTTP_ACCEPT'] ?? ''), 'text/html')) {
        $ready = !in_array(false, $items, true);
        $mode = $key === '' ? 'المفاتيح غير مضبوطة' : (str_contains($key, '_test_') ? 'تجريبي (Test)' : 'حقيقي (Live)');
        header('Content-Type: text/html; charset=utf-8');
        $rows = '';
        foreach ($items as $label => $ok) {
            $rows .= '<li class="' . ($ok ? 'ok' : 'bad') . '"><span>' . ($ok ? '✓' : '✗') . '</span>' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</li>';
        }
        $hook = selfUrl();
        echo '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">'
           . '<meta name="viewport" content="width=device-width,initial-scale=1"><title>فحص خادم الدفع — دُرمان</title><style>'
           . 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f2e8;color:#2a2c22;'
           . 'font-family:"SF Arabic","Noto Kufi Arabic","Segoe UI",system-ui,sans-serif;padding:24px}'
           . '.card{background:#fff;border-radius:22px;padding:30px;max-width:520px;width:100%;box-shadow:0 20px 50px rgba(62,68,41,.12)}'
           . 'h1{margin:0 0 6px;font-size:1.3rem}.sub{color:#6c6d5a;font-size:.85rem;margin:0 0 18px}'
           . '.state{padding:13px 16px;border-radius:14px;font-weight:800;margin-bottom:18px}'
           . '.state.on{background:rgba(62,68,41,.1);color:#3e4429}.state.off{background:#fdecec;color:#b73b3b}'
           . 'ul{list-style:none;margin:0;padding:0;display:grid;gap:9px}'
           . 'li{display:flex;align-items:center;gap:10px;font-size:.88rem;padding:10px 13px;border-radius:12px;background:#faf8f0}'
           . 'li span{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:.8rem;font-weight:900;color:#fff}'
           . 'li.ok span{background:#3e4429}li.bad span{background:#b73b3b}li.bad{background:#fdecec}'
           . '.urls{margin-top:20px;padding-top:16px;border-top:1px solid rgba(62,68,41,.12);font-size:.78rem;color:#6c6d5a;line-height:2}'
           . 'code{background:#f0ede2;padding:3px 7px;border-radius:7px;direction:ltr;display:inline-block;font-size:.75rem}'
           . '</style></head><body><div class="card"><h1>خادم الدفع — دُرمان</h1>'
           . '<p class="sub">الوضع: ' . htmlspecialchars($mode, ENT_QUOTES, 'UTF-8') . '</p>'
           . '<div class="state ' . ($ready ? 'on' : 'off') . '">' . ($ready ? 'جاهز ✅ — أكمل الخطوات في الأسفل' : 'ناقص ⚠️ — عبّئ القيم المعلّمة بـ ✗ في أعلى ملف pay.php') . '</div>'
           . '<ul>' . $rows . '</ul>'
           . '<div class="urls"><b>ضع هذين في لوحة بايموب:</b><br>Webhook: <code>' . htmlspecialchars($hook . '/webhook', ENT_QUOTES, 'UTF-8') . '</code><br>'
           . 'Redirect: <code>' . htmlspecialchars(rtrim((string) cfg('SITE_URL'), '/') . '/?paymob=return', ENT_QUOTES, 'UTF-8') . '</code><br><br>'
           . '<b>ضع هذا في لوحة إدارة الموقع:</b><br><code>' . htmlspecialchars($hook, ENT_QUOTES, 'UTF-8') . '</code></div>'
           . '</div></body></html>';
        exit;
    }
    out([
        'ok' => true,
        'service' => 'durman-paymob-php',
        'mode' => $key === '' ? 'missing' : (str_contains($key, '_test_') ? 'test' : 'live'),
        'configured' => [
            'secretKey'      => $key !== '',
            'publicKey'      => cfg('PAYMOB_PUBLIC_KEY') !== '',
            'hmacSecret'     => cfg('PAYMOB_HMAC_SECRET') !== '',
            'integrationIds' => count(integrationIds()),
            'siteUrl'        => cfg('SITE_URL') !== '',
            'firebase'       => cfg('FIREBASE_DATABASE_URL') !== '' && (cfg('FIREBASE_API_KEY') !== '' || cfg('FIREBASE_DATABASE_SECRET') !== ''),
        ],
        'currency' => 'OMR',
        'amountMultiplier' => multiplier(),
    ]);
}

/* ------------------------------------------------------------- create */
function buildIntention($body, $workerUrl) {
    $orderId = preg_replace('/\D/', '', (string) ($body['orderId'] ?? ''));
    if ($orderId === '') out(['error' => 'orderId مطلوب'], 400);
    $amount = $body['amount'] ?? null;
    if (!is_numeric($amount) || $amount <= 0 || $amount > 100000) out(['error' => 'مبلغ غير صالح'], 400);
    $customer = is_array($body['customer'] ?? null) ? $body['customer'] : [];
    $phone = omanPhone($customer['phone'] ?? '');
    if (strlen(preg_replace('/\D/', '', $phone)) < 8) out(['error' => 'رقم الهاتف غير صالح'], 400);
    $ids = integrationIds();
    if (!$ids) out(['error' => 'PAYMOB_INTEGRATION_IDS غير مضبوط'], 500);
    if (cfg('PAYMOB_SECRET_KEY') === '') out(['error' => 'PAYMOB_SECRET_KEY غير مضبوط'], 500);
    if (cfg('PAYMOB_PUBLIC_KEY') === '') out(['error' => 'PAYMOB_PUBLIC_KEY غير مضبوط'], 500);

    $amountMinor = (int) round($amount * multiplier());
    $orderNumber = cleanText($body['orderNumber'] ?? substr($orderId, -6), 12);
    $itemCount = 0;
    foreach (($body['items'] ?? []) as $i) $itemCount += (int) ($i['qty'] ?? 1);
    $parts = preg_split('/\s+/u', trim((string) ($customer['name'] ?? '')), -1, PREG_SPLIT_NO_EMPTY);
    $first = $parts[0] ?? 'عميل';
    $last = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '-';
    $host = parse_url((string) cfg('SITE_URL'), PHP_URL_HOST) ?: 'durman.local';
    $email = filter_var($customer['email'] ?? '', FILTER_VALIDATE_EMAIL) ? trim($customer['email']) : ('orders@' . $host);
    $reference = $orderId . '-' . (int) (microtime(true) * 1000);

    return [$reference, $amountMinor, [
        'amount' => $amountMinor,
        'currency' => 'OMR',
        'payment_methods' => $ids,
        'items' => [[
            'name' => cleanText('طلب دُرمان #' . $orderNumber, 60),
            'amount' => $amountMinor,
            'description' => cleanText($itemCount ? ($itemCount . ' منتج — ' . (!empty($body['gift']) ? 'طلب إهداء' : 'طلب متجر')) : 'طلب متجر دُرمان', 100),
            'quantity' => 1,
        ]],
        'billing_data' => [
            'first_name' => cleanText($first, 40),
            'last_name' => cleanText($last, 40),
            'phone_number' => $phone,
            'email' => $email,
            'street' => cleanText($customer['address'] ?? '', 120) ?: 'NA',
            'building' => 'NA', 'floor' => 'NA', 'apartment' => 'NA',
            'city' => cleanText($customer['governorate'] ?? '', 40) ?: 'Muscat',
            'state' => cleanText($customer['wilayat'] ?? '', 40) ?: 'NA',
            'country' => 'OM', 'postal_code' => 'NA',
        ],
        'customer' => ['first_name' => cleanText($first, 40), 'last_name' => cleanText($last, 40), 'email' => $email, 'extras' => ['phone' => $phone]],
        'extras' => ['order_id' => $orderId, 'order_number' => $orderNumber],
        'special_reference' => $reference,
        'expiration' => 3600,
        'notification_url' => $workerUrl . '/webhook',
        'redirection_url' => rtrim((string) cfg('SITE_URL'), '/') . '/?paymob=return',
    ], $orderId];
}

function actionCreate() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) out(['error' => 'JSON غير صالح'], 400);
    [$reference, $amountMinor, $payload, $orderId] = buildIntention($body, selfUrl());
    $base = rtrim((string) cfg('PAYMOB_BASE_URL'), '/');
    [$code, $data] = httpJson('POST', $base . '/v1/intention/', $payload, ['Authorization: Token ' . cfg('PAYMOB_SECRET_KEY')]);
    if ($code < 200 || $code >= 300 || empty($data['client_secret'])) {
        out(['error' => 'Paymob رفض إنشاء عملية الدفع', 'status' => $code, 'detail' => $data], 502);
    }
    $checkout = rtrim((string) cfg('PAYMOB_CHECKOUT_URL'), '/') . '/?publicKey=' . urlencode((string) cfg('PAYMOB_PUBLIC_KEY'))
        . '&clientSecret=' . urlencode($data['client_secret']);
    try {
        firebasePatch('subbha/orders/' . $orderId . '/paymob', [
            'intentionId' => $data['id'] ?? null,
            'paymobOrderId' => $data['intention_order_id'] ?? null,
            'reference' => $reference,
            'amountMinor' => $amountMinor,
            'createdAt' => gmdate('c'),
        ]);
    } catch (Throwable $e) { /* لا يوقف الدفع */ }
    out([
        'checkoutUrl' => $checkout,
        'intentionId' => $data['id'] ?? null,
        'paymobOrderId' => $data['intention_order_id'] ?? null,
        'reference' => $reference,
    ]);
}

/* ------------------------------------------------------------ webhook */
function paymentUpdate($obj) {
    $success = ($obj['success'] ?? null) === true || ($obj['success'] ?? null) === 'true';
    $status = $success ? 'paid' : 'failed';
    if ($success && (($obj['is_refunded'] ?? false) === true || ($obj['is_refund'] ?? false) === true)) $status = 'refunded';
    if ($success && (($obj['is_voided'] ?? false) === true || ($obj['is_void'] ?? false) === true)) $status = 'voided';
    $pan = pick($obj, 'source_data.pan');
    $sub = pick($obj, 'source_data.sub_type');
    $card = trim(($sub ? $sub : '') . ($pan ? ' •••• ' . $pan : ''));
    $cents = $obj['amount_cents'] ?? null;
    return [
        'paymentStatus' => $status,
        'paymentVerified' => true,
        'paymentGateway' => 'paymob',
        'paymobTransactionId' => isset($obj['id']) ? (string) $obj['id'] : null,
        'paymobOrderId' => pick($obj, 'order.id') !== null ? (string) pick($obj, 'order.id') : null,
        'paidAmount' => is_numeric($cents) ? $cents / multiplier() : null,
        'paidCurrency' => $obj['currency'] ?? 'OMR',
        'paidAt' => $obj['created_at'] ?? gmdate('c'),
        'paymentCard' => $card !== '' ? $card : null,
        'paymentMessage' => cleanText(pick($obj, 'data.message') ?? ($obj['txn_response_code'] ?? ''), 120) ?: null,
        'paymentUpdatedAt' => gmdate('c'),
    ];
}

function actionWebhook() {
    $secret = (string) cfg('PAYMOB_HMAC_SECRET');
    if ($secret === '') out(['error' => 'PAYMOB_HMAC_SECRET غير مضبوط'], 500);
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) out(['error' => 'JSON غير صالح'], 400);
    $obj = $body['obj'] ?? null;
    if (!is_array($obj)) out(['ignored' => true, 'reason' => 'no obj']);

    $given = strtolower((string) ($_GET['hmac'] ?? $body['hmac'] ?? ''));
    $expected = hash_hmac('sha512', hmacString($obj), $secret);
    if ($given === '' || !hash_equals($expected, $given)) out(['error' => 'HMAC غير مطابق'], 401);

    $ref = (string) (pick($obj, 'order.merchant_order_id') ?? pick($obj, 'order.special_reference') ?? '');
    $orderId = preg_replace('/\D/', '', explode('-', $ref)[0] ?? '');
    if ($orderId === '') out(['ok' => true, 'ignored' => true, 'reason' => 'no merchant_order_id']);

    $update = paymentUpdate($obj);
    try {
        firebasePatch('subbha/orders/' . $orderId, $update);
    } catch (Throwable $e) {
        out(['error' => 'تعذر تحديث الطلب في Firebase', 'detail' => $e->getMessage()], 502);
    }
    out(['ok' => true, 'orderId' => $orderId, 'paymentStatus' => $update['paymentStatus']]);
}

/* ------------------------------------------------------------- router */
$action = trim((string) ($_GET['action'] ?? ''), '/');
if ($action === '') $action = trim((string) ($_SERVER['PATH_INFO'] ?? ''), '/');
switch ($action) {
    case 'health':  actionHealth();
    case 'create':  actionCreate();
    case 'webhook': actionWebhook();
    default: out(['error' => 'not found', 'hint' => 'استخدم pay.php/health أو pay.php/create أو pay.php/webhook'], 404);
}
