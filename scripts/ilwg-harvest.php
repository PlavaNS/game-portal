<?php
/*
 * I Love Web Games - finds indie HTML5 developers who publish a contact address.
 * Modelled on bwa-harvest.php, with the queue kept above public_html so it is
 * not reachable from the web.
 *
 * It only collects. It never writes or sends an email: every game is still
 * played and judged by hand before anyone is contacted.
 *
 * cron: every 15 minutes
 */

$HOME  = '/home/escapero1';
$DATA  = $HOME . '/ilwg';                       // above public_html on purpose
$QUEUE = $DATA . '/queue.csv';
$SEEN  = $DATA . '/seen.txt';
$BLOCK = $DATA . '/blocklist.txt';
$LOG   = $DATA . '/harvest-log.txt';
$SENT  = $DATA . '/sent.csv';

$WANT  = 8;      // new candidates per run; every 15 min is plenty
$PAUSE = 1;      // seconds between requests, be a good guest
$UA    = 'ILoveWebGamesBot/1.0 (+https://ilovewebgames.com/submit-game/)';

$BROWSE = [
  'https://itch.io/games/newest/platform-web',
  'https://itch.io/games/new-and-popular/platform-web',
  'https://itch.io/games/top-rated/platform-web',
  'https://itch.io/jams/results',
];

@mkdir($DATA, 0700, true);
foreach ([$QUEUE, $SEEN, $BLOCK, $LOG, $SENT] as $f) if (!file_exists($f)) @touch($f);
if (filesize($QUEUE) === 0) file_put_contents($QUEUE, "found,source,game,game_url,studio,studio_url,email,status\n");
if (filesize($SENT)  === 0) file_put_contents($SENT,  "date,email,studio,game,game_url,outcome\n");
if (filesize($BLOCK) === 0) file_put_contents($BLOCK, implode("\n", [
  '# one domain or address fragment per line; anything matching is skipped',
  'ilovewebgames.com','escaperoom.co.rs','ballsofglory.app','itch.io',
  'noreply','no-reply','donotreply','abuse@','postmaster@','sentry','wixpress','example.com',
]) . "\n");

function ilwg_fetch($url, $ua) {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 4,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_USERAGENT      => $ua,
    CURLOPT_HTTPHEADER     => ['Accept: text/html,*/*'],
    CURLOPT_SSL_VERIFYPEER => true,
  ]);
  $body = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  if ($code !== 200 || !$body) return null;
  return strlen($body) > 1500000 ? substr($body, 0, 1500000) : $body;
}

function ilwg_emails($html, $block) {
  $out = [];
  if (!preg_match_all('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $html, $m)) return $out;
  foreach ($m[0] as $raw) {
    $e = rtrim(strtolower($raw), '.,;:');
    if (strlen($e) > 80) continue;
    if (preg_match('/\.(png|jpe?g|gif|webp|svg|css|js|woff2?)$/', $e)) continue;
    if (preg_match('/^[0-9a-f]{16,}@/', $e)) continue;
    foreach ($block as $b) if ($b !== '' && $b[0] !== '#' && strpos($e, $b) !== false) continue 2;
    $out[$e] = true;
  }
  return array_keys($out);
}

function ilwg_title($html) {
  if (!preg_match('/<title[^>]*>([^<]{2,160})<\/title>/i', $html, $m)) return '';
  $t = html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
  $t = preg_replace('/\s*[-|\x{00B7}]\s*(by .*|itch\.io).*$/iu', '', $t);
  return trim(preg_replace('/\s+/', ' ', $t));
}

$block = array_map('trim', file($BLOCK, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES));
$seen  = array_flip(array_map('trim', file($SEEN, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)));

$known = [];
foreach ([$QUEUE, $SENT] as $f) {
  foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $line, $m)) $known[strtolower($m[0])] = true;
  }
}

$added = 0; $visited = 0; $started = time();
$qf = fopen($QUEUE, 'a');
$sf = fopen($SEEN, 'a');

foreach ($BROWSE as $listUrl) {
  if ($added >= $WANT || time() - $started > 600) break;
  $list = ilwg_fetch($listUrl, $UA); sleep($PAUSE);
  if (!$list) { file_put_contents($LOG, date('c') . " list failed $listUrl\n", FILE_APPEND); continue; }

  preg_match_all('#https://[a-z0-9-]+\.itch\.io/[a-z0-9-]+#i', $list, $m);
  $games = array_values(array_unique($m[0]));
  shuffle($games);

  foreach ($games as $gameUrl) {
    if ($added >= $WANT || time() - $started > 600) break;
    if (isset($seen[$gameUrl])) continue;
    $seen[$gameUrl] = true; fwrite($sf, $gameUrl . "\n"); $visited++;

    $page = ilwg_fetch($gameUrl, $UA); sleep($PAUSE);
    if (!$page) continue;
    if (!preg_match('/html5|Play in browser|html_embed|iframe_placeholder/i', $page)) continue;  // must run in a browser

    preg_match('#^https://[a-z0-9-]+\.itch\.io#i', $gameUrl, $sm);
    $studioUrl = $sm[0] ?? '';
    preg_match('#//([a-z0-9-]+)\.#i', $studioUrl, $nm);
    $studio = $nm[1] ?? '';
    $game   = ilwg_title($page) ?: basename($gameUrl);

    $found = ilwg_emails($page, $block); $where = 'itch game page';

    if (!$found && $studioUrl) {
      $prof = ilwg_fetch($studioUrl, $UA); sleep($PAUSE);
      if ($prof) {
        $found = ilwg_emails($prof, $block); $where = 'itch profile';
        if (!$found && preg_match('#https?://(?!(?:[a-z0-9-]+\.)?itch\.io)[a-z0-9.-]+\.[a-z]{2,}#i', $prof, $sm2)) {
          foreach (['', '/contact', '/about'] as $p) {
            $h = ilwg_fetch(rtrim($sm2[0], '/') . $p, $UA); sleep($PAUSE);
            if ($h) { $e = ilwg_emails($h, $block); if ($e) { $found = $e; $where = 'studio site'; break; } }
          }
        }
      }
    }

    $email = '';
    foreach ($found as $e) if (!isset($known[$e])) { $email = $e; break; }
    if ($email === '') continue;

    $known[$email] = true;
    fputcsv($qf, [date('Y-m-d'), $where, $game, $gameUrl, $studio, $studioUrl, $email, 'new']);
    $added++;
  }
}

fclose($qf); fclose($sf);
file_put_contents($LOG, date('c') . " added $added, visited $visited\n", FILE_APPEND);
