$content = Get-Content 'D:\New folder\محمد صلاح.txt' -Encoding UTF8
$questions = @()
$currentQuestion = ''

foreach ($line in $content) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '') { continue }
    if ($trimmed -match '500 نقطة') { continue }
    if ($trimmed -match '🔥') { continue }
    
    if ($trimmed -match ' — ') {
        $parts = $trimmed -split ' — ', 2
        $questions += @{ q = $parts[0].Trim(); a = $parts[1].Trim() }
    }
    elseif ($trimmed -match '^الإجابة:') {
        $answer = $trimmed -replace '^الإجابة:\s*', ''
        $answer = $answer.TrimEnd('.')
        if ($currentQuestion -ne '') {
            $questions += @{ q = $currentQuestion; a = $answer }
            $currentQuestion = ''
        }
    }
    else {
        $currentQuestion = $trimmed
    }
}

Write-Host "Total: $($questions.Count)"
$i = 1
foreach ($q in $questions) {
    Write-Host "$i. $($q.q) | $($q.a)"
    $i++
}
