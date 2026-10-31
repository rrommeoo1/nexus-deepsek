# Repair double-encoded Romanian text in one file (round 42 tooling accident).
# The editor inserted UTF-8 that had been re-read as Latin-1, so every accented character landed as a
# two- or three-character mojibake. This maps each known sequence back, by code point, so no repair pass
# has to round-trip the whole file through another encoding.
param([Parameter(Mandatory = $true)][string]$Path)

$pairs = @(
  @((0x00C3, 0x00A2), 0x00E2),                 # Ã¢ -> â
  @((0x00C3, 0x00AE), 0x00EE),                 # Ã® -> î
  @((0x00C3, 0x00A3), 0x0103),                 # Ã£ -> ă (rare)
  @((0x00C4, 0x0083), 0x0103),                 # Äƒ -> ă
  @((0x00C4, 0x0192), 0x0103),                 # Äƒ -> ă (the same, with the real ligature)
  @((0x00C8, 0x2122), 0x0219),                 # È™ -> ș
  @((0x00C8, 0x203A), 0x021B),                 # È› -> ț
  @((0x00C5, 0x00A3), 0x015F),                 # Å£ -> ş
  @((0x00C5, 0x00B8), 0x0163),                 # Å¸ -> ţ
  @((0x00C2, 0x00B7), 0x00B7),                 # Â· -> ·
  @((0x00C2, 0x00BB), 0x00BB),                 # Â» -> »
  @((0x00E2, 0x20AC, 0x017E), 0x201E),         # â€ž -> „
  @((0x00E2, 0x20AC, 0x0153), 0x201C),         # â€œ -> “
  @((0x00E2, 0x20AC, 0x009D), 0x201D),         # â€  -> ”
  @((0x00E2, 0x20AC, 0x201C), 0x201D),         # â€œ -> ”
  @((0x00E2, 0x20AC, 0x201D), 0x2014),         # â€” -> —
  @((0x00E2, 0x20AC, 0x0094), 0x2014),         # â€” -> —
  @((0x00E2, 0x20AC, 0x2013), 0x2013),         # â€“ -> –
  @((0x00E2, 0x20AC, 0x2122), 0x2019),         # â€™ -> ’
  @((0x00E2, 0x20AC, 0x00A6), 0x2026)          # â€¦ -> …
)

$text = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
$before = $text
foreach ($pair in $pairs) {
  $from = -join ($pair[0] | ForEach-Object { [char]$_ })
  $to = [string][char]$pair[1]
  $text = $text.Replace($from, $to)
}
[IO.File]::WriteAllText($Path, $text, (New-Object Text.UTF8Encoding($false)))
if ($before -eq $text) { "unchanged: $Path" } else { "repaired:  $Path" }
