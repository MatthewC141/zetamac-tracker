// zetamac — terminal clone of arithmetic.zetamac.com (default settings) plus a
// score log and a local web dashboard.
//
//   ./zetamac                 play (loops until you quit)
//   ./zetamac add 52 [DATE]   log a score by hand (DATE = YYYY-MM-DD, default today)
//   ./zetamac stats           summary in the terminal
//   ./zetamac tracker [PORT]  open the progress dashboard (default port 8777)

#include <algorithm>
#include <cctype>
#include <chrono>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <map>
#include <random>
#include <set>
#include <sstream>
#include <string>
#include <vector>

#include <arpa/inet.h>
#include <netinet/in.h>
#include <poll.h>
#include <sys/socket.h>
#include <termios.h>
#include <unistd.h>
#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif

namespace fs = std::filesystem;
using Clock = std::chrono::steady_clock;

// ---- Game settings: identical to zetamac's defaults -------------------------
// Addition:        (2–100) + (2–100)
// Subtraction:     addition problems in reverse
// Multiplication:  (2–12) × (2–100)
// Division:        multiplication problems in reverse
// Duration:        120 seconds; a correct answer is accepted as soon as it's typed.
constexpr int kDuration = 120;
constexpr int kO80Seconds = 480;  // the 80-in-8 test: 80 questions in 8 minutes
constexpr int kAddLo = 2, kAddHi = 100;
constexpr int kMulLeftLo = 2, kMulLeftHi = 12;
constexpr int kMulRightLo = 2, kMulRightHi = 100;

static fs::path g_home;  // folder holding scores.csv and the pages (index.html, play.html, …)
static int g_port = 8777;  // port the tracker listens on (checked against each request's Host)

// ---- Small helpers ----------------------------------------------------------

static void out(const std::string& s) {
  const char* p = s.data();
  size_t left = s.size();
  while (left > 0) {
    ssize_t n = write(STDOUT_FILENO, p, left);
    if (n <= 0) return;
    p += n;
    left -= static_cast<size_t>(n);
  }
}

static std::string fmt_time(std::time_t t, const char* f) {
  std::tm tm{};
  localtime_r(&t, &tm);
  char buf[40];
  strftime(buf, sizeof buf, f, &tm);
  return buf;
}

static std::string today() { return fmt_time(std::time(nullptr), "%Y-%m-%d"); }

static bool parse_date(const std::string& s, std::tm& tm) {
  int y, m, d;
  if (s.size() != 10 || s[4] != '-' || s[7] != '-') return false;
  if (std::sscanf(s.c_str(), "%4d-%2d-%2d", &y, &m, &d) != 3) return false;
  tm = std::tm{};
  tm.tm_year = y - 1900;
  tm.tm_mon = m - 1;
  tm.tm_mday = d;
  tm.tm_hour = 12;
  tm.tm_isdst = -1;
  std::tm check = tm;
  std::mktime(&check);
  return check.tm_year == tm.tm_year && check.tm_mon == tm.tm_mon && check.tm_mday == tm.tm_mday;
}

static bool valid_date(const std::string& s) {
  std::tm tm;
  return parse_date(s, tm);
}

static std::string shift_date(const std::string& s, int days) {
  std::tm tm;
  if (!parse_date(s, tm)) return s;
  tm.tm_mday += days;
  std::time_t t = std::mktime(&tm);
  return fmt_time(t, "%Y-%m-%d");
}

static fs::path exe_dir() {
  if (const char* env = std::getenv("ZETAMAC_HOME")) return fs::path(env);
  char buf[4096];
#ifdef __APPLE__
  uint32_t size = sizeof buf;
  if (_NSGetExecutablePath(buf, &size) == 0) return fs::canonical(buf).parent_path();
#else
  ssize_t n = readlink("/proc/self/exe", buf, sizeof buf - 1);
  if (n > 0) {
    buf[n] = '\0';
    return fs::path(buf).parent_path();
  }
#endif
  return fs::current_path();
}

// ---- Score storage (scores.csv) ---------------------------------------------

struct Entry {
  std::string ts;    // local time, YYYY-MM-DDTHH:MM:SS
  std::string date;  // YYYY-MM-DD
  int score = 0;
  int seconds = kDuration;
  std::string source;  // "game" or "manual"
  std::string mode = "standard";  // "standard", or a squares mode (see kModes)
  int elapsed = 0;  // endless runs (seconds == 0): how long the run lasted, in seconds
};

// Game modes the tracker accepts. Squares: 1–99 or 100–999, "h" = hard (no numbers ending in 5,
// and no 1–20 in the 1–99 range). Practice drills: subtraction with / without borrowing, and
// "guided" (the arithmetic game with guided mode on, kept apart from real scores), and "mixed"
// (combined operations, like (5 + 2) × (15 + 9)), and "o80" (the Optiver 80-in-8 test).
static const std::set<std::string> kModes = {"standard", "sq99",     "sq99h",  "sq999", "sq999h",
                                             "sub-borrow", "sub-easy", "guided", "mixed", "o80"};

static const char* kHeader = "timestamp,date,score,seconds,source,mode,elapsed";

static fs::path scores_path() { return g_home / "scores.csv"; }

static std::vector<Entry> load_scores() {
  std::vector<Entry> list;
  std::ifstream in(scores_path());
  std::string line;
  while (std::getline(in, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();
    if (line.empty() || line.rfind("timestamp", 0) == 0) continue;
    std::stringstream ss(line);
    Entry e;
    std::string score, secs;
    if (!std::getline(ss, e.ts, ',') || !std::getline(ss, e.date, ',') || !std::getline(ss, score, ','))
      continue;
    std::getline(ss, secs, ',');
    std::getline(ss, e.source, ',');
    std::getline(ss, e.mode, ',');
    std::string elapsed;
    std::getline(ss, elapsed, ',');
    if (!elapsed.empty()) {
      try {
        e.elapsed = std::stoi(elapsed);
      } catch (...) {
      }
    }
    try {
      e.score = std::stoi(score);
      e.seconds = secs.empty() ? kDuration : std::stoi(secs);
    } catch (...) {
      continue;
    }
    if (!valid_date(e.date)) continue;
    // Hand-edited rows outside what the tracker ever writes are skipped (huge values would
    // overflow the stats maths).
    if (e.score < 0 || e.score > 999999 || e.elapsed < 0 || e.elapsed > 999999 ||
        (e.seconds != 0 && e.seconds != 30 && e.seconds != kDuration && e.seconds != kO80Seconds))
      continue;
    if (e.source.empty()) e.source = "manual";
    if (e.mode.empty()) e.mode = "standard";  // rows from before modes existed
    list.push_back(e);
  }
  return list;
}

static std::string entry_line(const Entry& e) {
  return e.ts + "," + e.date + "," + std::to_string(e.score) + "," + std::to_string(e.seconds) + "," +
         e.source + "," + e.mode + "," + std::to_string(e.elapsed) + "\n";
}

static bool save_all(const std::vector<Entry>& list) {
  fs::path tmp = scores_path();
  tmp += ".tmp";
  {
    std::ofstream f(tmp, std::ios::trunc);
    if (!f) return false;
    f << kHeader << "\n";
    for (const Entry& e : list) f << entry_line(e);
    if (!f) return false;
  }
  std::error_code ec;
  fs::rename(tmp, scores_path(), ec);
  return !ec;
}

static bool append_score(const Entry& e) {
  bool fresh = !fs::exists(scores_path());
  std::ofstream f(scores_path(), std::ios::app);
  if (!f) return false;
  if (fresh) f << kHeader << "\n";
  f << entry_line(e);
  return static_cast<bool>(f);
}

static Entry make_entry(int score, const std::string& date, const std::string& source, int seconds = kDuration,
                        const std::string& mode = "standard") {
  Entry e;
  e.mode = mode;
  e.date = date;
  e.score = score;
  e.seconds = seconds;
  e.source = source;
  e.ts = date == today() ? fmt_time(std::time(nullptr), "%Y-%m-%dT%H:%M:%S") : date + "T12:00:00";
  return e;
}

// ---- Stats ------------------------------------------------------------------

struct Summary {
  int games = 0, best = 0, days = 0, streak = 0;
  int today_games = 0, today_best = 0;
  double today_avg = 0;
};

static Summary summarize(const std::vector<Entry>& list) {
  Summary s;
  std::set<std::string> dates;
  const std::string t = today();
  int today_sum = 0;
  for (const Entry& e : list) {
    dates.insert(e.date);  // any game counts toward days played and the streak
    if (e.seconds != kDuration || e.mode != "standard") continue;
    s.games++;
    s.best = std::max(s.best, e.score);
    if (e.date == t) {
      s.today_games++;
      s.today_best = std::max(s.today_best, e.score);
      today_sum += e.score;
    }
  }
  s.days = static_cast<int>(dates.size());
  if (s.today_games) s.today_avg = static_cast<double>(today_sum) / s.today_games;
  // A streak stays alive through today until you miss a full day.
  std::string d = dates.count(t) ? t : shift_date(t, -1);
  while (dates.count(d)) {
    s.streak++;
    d = shift_date(d, -1);
  }
  return s;
}

static std::string sparkline(const std::vector<Entry>& list, size_t n) {
  static const char* bars[] = {"▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"};
  if (list.empty()) return "";
  size_t start = list.size() > n ? list.size() - n : 0;
  int lo = 1 << 30, hi = 0;
  for (size_t i = start; i < list.size(); i++) {
    lo = std::min(lo, list[i].score);
    hi = std::max(hi, list[i].score);
  }
  std::string s;
  for (size_t i = start; i < list.size(); i++) {
    int level = hi == lo ? 4 : (list[i].score - lo) * 7 / (hi - lo);
    s += bars[level];
  }
  return s + "  (" + std::to_string(lo) + "–" + std::to_string(hi) + ")";
}

static void print_summary(const std::vector<Entry>& list) {
  Summary s = summarize(list);
  char buf[512];
  std::snprintf(buf, sizeof buf,
                "  Today       %d game%s · best %d · avg %.1f\n"
                "  All-time    best %d · %d games · %d days played\n"
                "  Streak      %d day%s\n",
                s.today_games, s.today_games == 1 ? "" : "s", s.today_best, s.today_avg, s.best, s.games,
                s.days, s.streak, s.streak == 1 ? "" : "s");
  out(buf);
  std::vector<Entry> full;
  for (const Entry& e : list)
    if (e.seconds == kDuration && e.mode == "standard") full.push_back(e);
  if (!full.empty()) out("  Last games  " + sparkline(full, 20) + "\n");
}

// ---- Terminal game ----------------------------------------------------------

static termios g_orig_term;
static bool g_raw = false;
static bool g_alt = false;

static void restore_term() {
  if (g_alt) {
    out("\033[?1049l");
    g_alt = false;
  }
  if (g_raw) {
    tcsetattr(STDIN_FILENO, TCSAFLUSH, &g_orig_term);
    g_raw = false;
  }
}

static void on_signal(int sig) {
  restore_term();
  std::signal(sig, SIG_DFL);
  std::raise(sig);
}

static bool enter_raw() {
  if (!isatty(STDIN_FILENO)) return false;
  if (tcgetattr(STDIN_FILENO, &g_orig_term) != 0) return false;
  termios raw = g_orig_term;
  raw.c_lflag &= ~static_cast<tcflag_t>(ICANON | ECHO | ISIG | IEXTEN);
  raw.c_iflag &= ~static_cast<tcflag_t>(IXON | ICRNL);
  raw.c_cc[VMIN] = 0;
  raw.c_cc[VTIME] = 0;
  if (tcsetattr(STDIN_FILENO, TCSAFLUSH, &raw) != 0) return false;
  g_raw = true;
  return true;
}

// Waits up to timeout_ms (-1 = forever) for input; returns bytes read.
static int read_input(char* buf, int size, int timeout_ms) {
  pollfd p{STDIN_FILENO, POLLIN, 0};
  if (poll(&p, 1, timeout_ms) <= 0) return 0;
  ssize_t n = read(STDIN_FILENO, buf, static_cast<size_t>(size));
  return n > 0 ? static_cast<int>(n) : 0;
}

static char wait_key() {
  char buf[16];
  for (;;) {
    int n = read_input(buf, sizeof buf, -1);
    if (n > 0) return buf[0];
  }
}

struct Problem {
  std::string text;
  std::string answer;
};

static Problem next_problem(std::mt19937& rng) {
  auto pick = [&](int lo, int hi) { return std::uniform_int_distribution<int>(lo, hi)(rng); };
  auto s = [](int v) { return std::to_string(v); };
  switch (pick(0, 3)) {
    case 0: {
      int a = pick(kAddLo, kAddHi), b = pick(kAddLo, kAddHi);
      return {s(a) + " + " + s(b), s(a + b)};
    }
    case 1: {
      int a = pick(kAddLo, kAddHi), b = pick(kAddLo, kAddHi);
      return {s(a + b) + " – " + s(a), s(b)};
    }
    case 2: {
      int a = pick(kMulLeftLo, kMulLeftHi), b = pick(kMulRightLo, kMulRightHi);
      return {s(a) + " × " + s(b), s(a * b)};
    }
    default: {
      int a = pick(kMulLeftLo, kMulLeftHi), b = pick(kMulRightLo, kMulRightHi);
      return {s(a * b) + " ÷ " + s(a), s(b)};
    }
  }
}

// Plays one 120-second round. Returns the score, or -1 if the round was quit.
static int play_round(std::mt19937& rng) {
  out("\033[?1049h\033[H\033[2J");
  g_alt = true;
  out("\033[2;3HZetamac · 120 seconds · + – × ÷ (default settings)"
      "\033[4;3HType answers — correct ones are accepted instantly, no Enter needed."
      "\033[5;3HBackspace fixes mistakes. Esc quits a round without saving."
      "\033[7;3HPress any key to start.");
  char k = wait_key();
  if (k == 27 || k == 3 || k == 'q') {
    restore_term();
    enter_raw();
    return -1;
  }

  out("\033[H\033[2J");
  Problem p = next_problem(rng);
  std::string input;
  int score = 0;
  int shown = -1;
  const auto end = Clock::now() + std::chrono::seconds(kDuration);

  auto draw = [&]() {
    out("\033[2;3H\033[2KSeconds left: " + std::to_string(shown) + "\033[2;32HScore: " + std::to_string(score) +
        "\033[5;7H\033[2K" + p.text + " = " + input);
  };

  for (;;) {
    auto now = Clock::now();
    if (now >= end) break;
    long rem = static_cast<long>(std::chrono::duration_cast<std::chrono::milliseconds>(end - now).count());
    int secs = static_cast<int>((rem + 999) / 1000);
    if (secs != shown) {
      shown = secs;
      draw();
    }
    // Sleep until the next key or the next tick of the clock, whichever is first.
    int until_tick = static_cast<int>(rem - (secs - 1) * 1000L);
    char buf[64];
    int n = read_input(buf, sizeof buf, std::max(1, until_tick));
    if (n == 0) continue;

    for (int i = 0; i < n; i++) {
      char c = buf[i];
      if (c == 27) {
        if (i + 1 < n && (buf[i + 1] == '[' || buf[i + 1] == 'O')) {  // arrow/function key: ignore
          i += 2;
          while (i < n && !(buf[i] >= 0x40 && buf[i] <= 0x7e)) i++;
          continue;
        }
        restore_term();
        enter_raw();
        return -1;
      }
      if (c == 3) {
        restore_term();
        enter_raw();
        return -1;
      }
      if (c >= '0' && c <= '9') {
        if (input.size() < 7) input += c;
      } else if (c == 127 || c == 8) {
        if (!input.empty()) input.pop_back();
      } else if (c == 21) {  // Ctrl-U
        input.clear();
      }
      if (input == p.answer) {
        score++;
        p = next_problem(rng);
        input.clear();
      }
    }
    draw();
  }

  restore_term();
  enter_raw();
  return score;
}

static int cmd_play() {
  if (!enter_raw()) {
    std::fprintf(stderr, "zetamac: play needs an interactive terminal\n");
    return 1;
  }
  std::signal(SIGTERM, on_signal);
  std::signal(SIGHUP, on_signal);
  std::atexit(restore_term);

  std::mt19937 rng(std::random_device{}());
  for (;;) {
    std::vector<Entry> before = load_scores();
    int prev_best = summarize(before).best;

    int score = play_round(rng);
    if (score < 0) {
      out("\n  Round abandoned — nothing saved.\n");
    } else {
      Entry e = make_entry(score, today(), "game");
      bool saved = append_score(e);
      before.push_back(e);
      out("\n  Score: \033[1m" + std::to_string(score) + "\033[0m");
      if (!before.empty() && score > prev_best && before.size() > 1)
        out("   ★ new personal best (was " + std::to_string(prev_best) + ")");
      out("\n\n");
      if (!saved) out("  ! could not write " + scores_path().string() + "\n");
      print_summary(before);
    }
    out("\n  [Enter/Space] play again    [q] quit    (progress charts: ./zetamac tracker)\n");

    // Swallow keys typed as the timer ran out so they don't skip this screen.
    usleep(600 * 1000);
    tcflush(STDIN_FILENO, TCIFLUSH);
    for (;;) {
      char k = wait_key();
      if (k == 'q' || k == 'Q' || k == 27 || k == 3) {
        out("\n");
        return 0;
      }
      if (k == '\r' || k == '\n' || k == ' ') break;
    }
  }
}

// ---- Local dashboard server -------------------------------------------------

static std::string json_escape(const std::string& s) {
  std::string r;
  for (char c : s) {
    if (c == '"' || c == '\\') r += '\\';
    if (static_cast<unsigned char>(c) < 0x20) continue;
    r += c;
  }
  return r;
}

// ---- Per-question details (details/<timestamp>.json) -----------------------
// The browser game sends a JSON array with one object per question it asked. The server doesn't
// interpret it; it checks the shape loosely and stores it next to the score it belongs to.

static bool valid_ts(const std::string& ts) {
  if (ts.size() != 19 || ts[10] != 'T') return false;
  for (char c : ts)
    if (!(std::isdigit(static_cast<unsigned char>(c)) || c == '-' || c == ':' || c == 'T')) return false;
  return true;
}

static fs::path detail_path(const std::string& ts) {
  std::string name = ts;
  std::replace(name.begin(), name.end(), ':', '-');
  return g_home / "details" / (name + ".json");
}

static bool valid_detail(const std::string& d) {
  if (d.size() < 2 || d.size() > 2000000 || d.front() != '[' || d.back() != ']') return false;
  for (char c : d)
    if (static_cast<unsigned char>(c) < 0x20) return false;
  return true;
}

static bool save_detail(const std::string& ts, const std::string& detail) {
  std::error_code ec;
  fs::create_directories(g_home / "details", ec);
  std::ofstream f(detail_path(ts), std::ios::trunc);
  f << detail;
  return static_cast<bool>(f);
}

static std::string scores_json() {
  std::vector<Entry> list = load_scores();
  std::string j = "[";
  for (size_t i = 0; i < list.size(); i++) {
    const Entry& e = list[i];
    if (i) j += ",";
    j += "{\"i\":" + std::to_string(i) + ",\"ts\":\"" + json_escape(e.ts) + "\",\"date\":\"" +
         json_escape(e.date) + "\",\"score\":" + std::to_string(e.score) +
         ",\"seconds\":" + std::to_string(e.seconds) + ",\"source\":\"" + json_escape(e.source) + "\",\"mode\":\"" + json_escape(e.mode) +
         "\",\"elapsed\":" + std::to_string(e.elapsed) +
         ",\"detail\":" + (valid_ts(e.ts) && fs::exists(detail_path(e.ts)) ? "true" : "false") + "}";
  }
  return j + "]";
}

static std::string url_decode(const std::string& s) {
  std::string r;
  for (size_t i = 0; i < s.size(); i++) {
    if (s[i] == '+') {
      r += ' ';
    } else if (s[i] == '%' && i + 2 < s.size()) {
      r += static_cast<char>(std::strtol(s.substr(i + 1, 2).c_str(), nullptr, 16));
      i += 2;
    } else {
      r += s[i];
    }
  }
  return r;
}

static std::map<std::string, std::string> parse_form(const std::string& body) {
  std::map<std::string, std::string> form;
  std::stringstream ss(body);
  std::string pair;
  while (std::getline(ss, pair, '&')) {
    size_t eq = pair.find('=');
    if (eq == std::string::npos) continue;
    form[url_decode(pair.substr(0, eq))] = url_decode(pair.substr(eq + 1));
  }
  return form;
}

static bool parse_int(const std::string& s, int& v) {
  if (s.empty() || s.size() > 6) return false;
  for (char c : s)
    if (c < '0' || c > '9') return false;
  v = std::stoi(s);
  return true;
}

static void respond(int fd, const std::string& status, const std::string& type, const std::string& body) {
  std::string r = "HTTP/1.1 " + status + "\r\nContent-Type: " + type +
                  "\r\nContent-Length: " + std::to_string(body.size()) +
                  "\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY"
                  "\r\nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                  "img-src 'self' data:; connect-src 'self' https://ktjcczwwpzzigwfbsynq.supabase.co; object-src 'none'; base-uri 'none'; "
                  "form-action 'self'; frame-ancestors 'none'"
                  "\r\nReferrer-Policy: no-referrer"
                  "\r\nConnection: close\r\n\r\n" + body;
  const char* p = r.data();
  size_t left = r.size();
  while (left > 0) {
    ssize_t n = send(fd, p, left, 0);
    if (n <= 0) return;
    p += n;
    left -= static_cast<size_t>(n);
  }
}

static void respond_error(int fd, const std::string& status, const std::string& msg) {
  respond(fd, status, "application/json", "{\"error\":\"" + json_escape(msg) + "\"}");
}

// Game length for a posted score: 120 (the default) or 30 seconds, or 480 for the 80-in-8 test.
// Returns 0 if invalid (see length_fits for which lengths go with which game).
static int parse_seconds(const std::map<std::string, std::string>& form) {
  auto it = form.find("seconds");
  if (it == form.end() || it->second.empty() || it->second == "120") return 120;
  if (it->second == "480") return kO80Seconds;
  return it->second == "30" ? 30 : 0;
}

// The 80-in-8 test is always 8 minutes (and scores at most 80); nothing else is.
static bool length_fits(const std::string& mode, int seconds, int score) {
  return mode == "o80" ? seconds == kO80Seconds && score <= 80 : seconds != kO80Seconds;
}

// Game mode for a posted score: "standard" unless a known squares mode is given. Empty if invalid.
static std::string parse_mode(const std::map<std::string, std::string>& form) {
  auto it = form.find("mode");
  if (it == form.end() || it->second.empty()) return "standard";
  return kModes.count(it->second) ? it->second : "";
}

// The Host a request was sent to. Only our own address is accepted, so a website that points its
// domain at 127.0.0.1 (DNS rebinding) can't read or change scores through the victim's browser.
static bool allowed_host(const std::string& lower_head) {
  size_t h = lower_head.find("\r\nhost:");
  if (h == std::string::npos) return false;
  size_t start = h + 7, end = lower_head.find("\r\n", start);
  std::string host = lower_head.substr(start, end == std::string::npos ? std::string::npos : end - start);
  host.erase(0, host.find_first_not_of(" \t"));
  host.erase(host.find_last_not_of(" \t") + 1);
  const std::string port = ":" + std::to_string(g_port);
  return host == "127.0.0.1" + port || host == "localhost" + port;
}

static void handle_client(int fd) {
  timeval tv{3, 0};
  setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
  setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);  // nor one that stops reading the reply
  // One request at a time, so a client that trickles bytes must not hold the server for long.
  const auto deadline = Clock::now() + std::chrono::seconds(10);

  std::string req;
  char buf[8192];
  size_t header_end;
  while ((header_end = req.find("\r\n\r\n")) == std::string::npos) {
    ssize_t n = recv(fd, buf, sizeof buf, 0);
    if (n <= 0 || req.size() > 65536 || Clock::now() > deadline) return;
    req.append(buf, static_cast<size_t>(n));
  }
  std::string head = req.substr(0, header_end);
  std::string lower = head;
  std::transform(lower.begin(), lower.end(), lower.begin(), ::tolower);

  size_t content_length = 0;
  size_t cl = lower.find("\r\ncontent-length:");
  if (cl != std::string::npos) content_length = std::strtoul(lower.c_str() + cl + 17, nullptr, 10);
  if (content_length > 2100000) return;  // room for long endless-run details
  size_t body_start = header_end + 4;
  while (req.size() - body_start < content_length) {
    ssize_t n = recv(fd, buf, sizeof buf, 0);
    if (n <= 0 || Clock::now() > deadline) return;
    req.append(buf, static_cast<size_t>(n));
  }
  std::string body = req.substr(body_start, content_length);

  std::stringstream first(head.substr(0, head.find("\r\n")));
  std::string method, path;
  first >> method >> path;
  std::string query = path.find('?') == std::string::npos ? "" : path.substr(path.find('?') + 1);
  path = path.substr(0, path.find('?'));
  if (!allowed_host(lower)) return respond_error(fd, "421 Misdirected Request", "Open the tracker at http://127.0.0.1:" + std::to_string(g_port) + "/");

  // Pages by file name (the links between them are relative, so the same files also work as a
  // static website) plus the short names older bookmarks use.
  static const std::map<std::string, std::string> kPages = {
      {"/", "index.html"},          {"/index.html", "index.html"},     {"/play", "play.html"},
      {"/play.html", "play.html"},  {"/squares", "squares.html"},      {"/squares.html", "squares.html"},
      {"/practice", "practice.html"}, {"/practice.html", "practice.html"}, {"/store.js", "store.js"},
      {"/launch.js", "launch.js"},  {"/launch.css", "launch.css"},       {"/dashboard.js", "dashboard.js"},
      {"/play.js", "play.js"},      {"/squares.js", "squares.js"},      {"/practice.js", "practice.js"},
      {"/guide", "guide.html"},     {"/guide.html", "guide.html"},      {"/guide.js", "guide.js"},
      {"/leaderboard", "leaderboard.html"}, {"/leaderboard.html", "leaderboard.html"}, {"/leaderboard.js", "leaderboard.js"},
      {"/account", "account.html"}, {"/account.html", "account.html"},  {"/account.js", "account.js"},
      {"/mixed", "mixed.html"},     {"/mixed.html", "mixed.html"},      {"/mixed.js", "mixed.js"},
      {"/duel", "duel.html"},       {"/duel.html", "duel.html"},        {"/duel.js", "duel.js"},
      {"/problems.js", "problems.js"}, {"/matches.js", "matches.js"}, {"/duel-history.js", "duel-history.js"},
      {"/optiver", "optiver.html"}, {"/optiver.html", "optiver.html"}, {"/optiver.js", "optiver.js"},
      {"/cloud.js", "cloud.js"},    {"/site.css", "site.css"}};
  if (method == "GET" && kPages.count(path)) {
    const std::string& page = kPages.at(path);
    std::ifstream f(g_home / page);
    if (!f) return respond_error(fd, "500 Internal Server Error", page + " not found next to zetamac");
    std::stringstream ss;
    ss << f.rdbuf();
    const std::string ext = page.substr(page.rfind('.'));
    const char* type = ext == ".js" ? "text/javascript; charset=utf-8" : ext == ".css" ? "text/css; charset=utf-8" : "text/html; charset=utf-8";
    return respond(fd, "200 OK", type, ss.str());
  }
  if (method == "GET" && path.rfind("/fonts/", 0) == 0) {  // self-hosted webfonts for the dashboard
    std::string name = path.substr(7);
    bool ok = name.size() > 6 && name.size() < 64 && name.compare(name.size() - 6, 6, ".woff2") == 0;
    for (size_t i = 0; ok && i + 6 < name.size(); i++) ok = std::isalnum(static_cast<unsigned char>(name[i])) || name[i] == '-';
    if (!ok) return respond_error(fd, "404 Not Found", "not found");
    std::ifstream f(g_home / "fonts" / name, std::ios::binary);
    if (!f) return respond_error(fd, "404 Not Found", "not found");
    std::stringstream ss;
    ss << f.rdbuf();
    return respond(fd, "200 OK", "font/woff2", ss.str());
  }
  if (method == "GET" && path == "/api/scores") return respond(fd, "200 OK", "application/json", scores_json());
  if (method == "GET" && path == "/api/detail") {
    std::string ts = parse_form(query)["ts"];
    if (!valid_ts(ts)) return respond_error(fd, "400 Bad Request", "Bad game timestamp.");
    std::ifstream f(detail_path(ts));
    if (!f) return respond_error(fd, "404 Not Found", "No question-by-question data for this game.");
    std::stringstream ss;
    ss << f.rdbuf();
    return respond(fd, "200 OK", "application/json", "{\"ts\":\"" + ts + "\",\"questions\":" + ss.str() + "}");
  }

  if (method == "POST") {
    // Custom header forces a CORS preflight, so other websites can't post here.
    if (lower.find("\r\nx-zetamac: 1") == std::string::npos)
      return respond_error(fd, "403 Forbidden", "missing X-Zetamac header");
    auto form = parse_form(body);

    if (path == "/api/scores") {
      int score;
      std::string date = form.count("date") ? form["date"] : today();
      if (!parse_int(form["score"], score) || score > 500)
        return respond_error(fd, "400 Bad Request", "Score must be a whole number from 0 to 500.");
      if (!valid_date(date)) return respond_error(fd, "400 Bad Request", "Date must be YYYY-MM-DD.");
      if (date > today()) return respond_error(fd, "400 Bad Request", "That date is in the future.");
      int seconds = parse_seconds(form);
      if (!seconds) return respond_error(fd, "400 Bad Request", "Game length must be 30 or 120 seconds.");
      std::string mode = parse_mode(form);
      if (mode.empty()) return respond_error(fd, "400 Bad Request", "Unknown game mode.");
      if (!length_fits(mode, seconds, score)) return respond_error(fd, "400 Bad Request", "That game length doesn't fit that game.");
      if (!append_score(make_entry(score, date, "manual", seconds, mode)))
        return respond_error(fd, "500 Internal Server Error", "Could not write scores.csv.");
      return respond(fd, "200 OK", "application/json", scores_json());
    }
    if (path == "/api/game") {  // a finished round from the browser game: always today
      // seconds=0 is an endless run: no timer, score = questions answered, elapsed = run length.
      bool endless = form["seconds"] == "0";
      int score, elapsed = 0;
      if (!parse_int(form["score"], score) || score > (endless ? 999999 : 500))
        return respond_error(fd, "400 Bad Request", "Score is out of range.");
      int seconds = endless ? 0 : parse_seconds(form);
      if (!endless && !seconds) return respond_error(fd, "400 Bad Request", "Game length must be 30 or 120 seconds.");
      if (endless && !parse_int(form["elapsed"], elapsed))
        return respond_error(fd, "400 Bad Request", "Endless runs need an elapsed time in seconds.");
      std::string mode = parse_mode(form);
      if (mode.empty()) return respond_error(fd, "400 Bad Request", "Unknown game mode.");
      if (!endless && !length_fits(mode, seconds, score)) return respond_error(fd, "400 Bad Request", "That game length doesn't fit that game.");
      if (endless && mode == "o80") return respond_error(fd, "400 Bad Request", "The 80-in-8 test has no endless version.");
      // The 80-in-8 test keeps how long it took too (its leaderboard tie-break), up to its 8 minutes.
      if (mode == "o80" && (!parse_int(form["elapsed"], elapsed) || elapsed > kO80Seconds)) elapsed = 0;
      Entry e = make_entry(score, today(), "game", seconds, mode);
      e.elapsed = elapsed;
      if (!append_score(e))
        return respond_error(fd, "500 Internal Server Error", "Could not write scores.csv.");
      if (valid_detail(form["detail"])) save_detail(e.ts, form["detail"]);
      return respond(fd, "200 OK", "application/json", scores_json());
    }
    if (path == "/api/delete") {
      int index;
      std::vector<Entry> list = load_scores();
      if (!parse_int(form["index"], index) || index >= static_cast<int>(list.size()))
        return respond_error(fd, "400 Bad Request", "No such entry.");
      if (form["ts"] != list[static_cast<size_t>(index)].ts)
        return respond_error(fd, "409 Conflict", "Scores changed since the page loaded — refresh and try again.");
      std::error_code ec;
      // Only games have question logs; a hand-logged score with the same timestamp must not take one.
      const Entry& gone = list[static_cast<size_t>(index)];
      if (gone.source == "game" && valid_ts(gone.ts)) fs::remove(detail_path(gone.ts), ec);
      list.erase(list.begin() + index);
      if (!save_all(list)) return respond_error(fd, "500 Internal Server Error", "Could not write scores.csv.");
      return respond(fd, "200 OK", "application/json", scores_json());
    }
  }
  respond_error(fd, "404 Not Found", "not found");
}

static int cmd_tracker(int port) {
  g_port = port;
  std::signal(SIGPIPE, SIG_IGN);
  int srv = socket(AF_INET, SOCK_STREAM, 0);
  if (srv < 0) {
    std::perror("socket");
    return 1;
  }
  int yes = 1;
  setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof yes);
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(static_cast<uint16_t>(port));
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (bind(srv, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0) {
    std::fprintf(stderr, "zetamac: port %d is busy — try ./zetamac tracker %d\n", port, port + 1);
    return 1;
  }
  listen(srv, 16);

  std::string url = "http://127.0.0.1:" + std::to_string(port) + "/";
  std::printf("Zetamac tracker running at %s  (Ctrl-C to stop)\n", url.c_str());
  std::fflush(stdout);
  if (!std::getenv("ZETAMAC_NO_OPEN")) {
#ifdef __APPLE__
    std::system(("open " + url).c_str());
#else
    std::system(("xdg-open " + url + " >/dev/null 2>&1 &").c_str());
#endif
  }

  for (;;) {
    int fd = accept(srv, nullptr, nullptr);
    if (fd < 0) continue;
    handle_client(fd);
    close(fd);
  }
}

// ---- CLI --------------------------------------------------------------------

static int cmd_add(int argc, char** argv) {
  int score;
  if (argc < 3 || !parse_int(argv[2], score) || score > 500) {
    std::fprintf(stderr, "usage: zetamac add SCORE [YYYY-MM-DD]\n");
    return 1;
  }
  std::string date = argc > 3 ? argv[3] : today();
  if (!valid_date(date) || date > today()) {
    std::fprintf(stderr, "zetamac: bad date '%s' (use YYYY-MM-DD, not in the future)\n", date.c_str());
    return 1;
  }
  if (!append_score(make_entry(score, date, "manual"))) {
    std::fprintf(stderr, "zetamac: could not write %s\n", scores_path().c_str());
    return 1;
  }
  std::printf("Logged %d on %s.\n\n", score, date.c_str());
  std::fflush(stdout);
  print_summary(load_scores());
  return 0;
}

static void usage() {
  std::printf(
      "zetamac — mental arithmetic drill (zetamac default settings) + progress tracker\n\n"
      "  zetamac                  play\n"
      "  zetamac add SCORE [DATE]  log a score by hand (DATE = YYYY-MM-DD, default today)\n"
      "  zetamac stats            show your stats\n"
      "  zetamac tracker [PORT]   open the progress dashboard in your browser (default 8777)\n\n"
      "Scores live in %s\n",
      scores_path().c_str());
}

int main(int argc, char** argv) {
  g_home = exe_dir();
  std::string cmd = argc > 1 ? argv[1] : "play";

  if (cmd == "play") return cmd_play();
  if (cmd == "add") return cmd_add(argc, argv);
  if (cmd == "stats") {
    print_summary(load_scores());
    return 0;
  }
  if (cmd == "tracker" || cmd == "serve") {
    int port = 8777;
    if (argc > 2 && (!parse_int(argv[2], port) || port < 1 || port > 65535)) {
      std::fprintf(stderr, "zetamac: bad port\n");
      return 1;
    }
    return cmd_tracker(port);
  }
  usage();
  return cmd == "help" || cmd == "-h" || cmd == "--help" ? 0 : 1;
}
