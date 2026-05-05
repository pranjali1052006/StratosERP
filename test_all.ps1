$base = 'http://localhost:5000/api'
$results = @()

function Test-Endpoint {
    param($label, $method, $path, $headers, $body)
    try {
        $params = @{
            Uri = "$base$path"
            Method = $method
            Headers = $headers
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        if ($body) {
            $params.Body = $body
            $params.ContentType = 'application/json'
        }
        $r = Invoke-WebRequest @params
        return "$label`: $($r.StatusCode) OK"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $body = ""
        try { $body = $_.ErrorDetails.Message } catch {}
        return "$label`: $code FAIL - $body"
    }
}

function Get-Token($email, $password, $type='faculty') {
    try {
        $b = "{`"email`":`"$email`",`"password`":`"$password`"}"
        $r = Invoke-WebRequest -Uri "$base/auth/login/$type" -Method POST -ContentType 'application/json' -Body $b -UseBasicParsing -ErrorAction Stop
        return ($r.Content | ConvertFrom-Json).data.token
    } catch { return $null }
}

# Get all tokens
$adminToken = Get-Token 'admin@stratoserp.edu' 'Admin@123'
$hodToken = Get-Token 'hod@stratoserp.edu' 'Admin@123'
$ciToken = Get-Token 'classincharge@stratoserp.edu' 'Admin@123'
$siToken = Get-Token 'subjectincharge@stratoserp.edu' 'Admin@123'
$tgToken = Get-Token 'tg@stratoserp.edu' 'Admin@123'
$stuToken = Get-Token 'student@stratoserp.edu' 'Admin@123' 'student'

Write-Host "=== TOKEN STATUS ==="
Write-Host "Admin: $(if($adminToken){'OK'}else{'FAIL'})"
Write-Host "HOD: $(if($hodToken){'OK'}else{'FAIL'})"
Write-Host "ClassIncharge: $(if($ciToken){'OK'}else{'FAIL'})"
Write-Host "SubjectIncharge: $(if($siToken){'OK'}else{'FAIL'})"
Write-Host "TG: $(if($tgToken){'OK'}else{'FAIL'})"
Write-Host "Student: $(if($stuToken){'OK'}else{'FAIL'})"

$ah = @{Authorization="Bearer $adminToken"}
$hh = @{Authorization="Bearer $hodToken"}
$cih = @{Authorization="Bearer $ciToken"}
$sih = @{Authorization="Bearer $siToken"}
$tgh = @{Authorization="Bearer $tgToken"}
$sh = @{Authorization="Bearer $stuToken"}

Write-Host ""
Write-Host "=== HEALTH ==="
Write-Host (Test-Endpoint 'GET /api/health' 'GET' '/health' @{})

Write-Host ""
Write-Host "=== AUTH ==="
Write-Host (Test-Endpoint 'GET /me (admin)' 'GET' '/auth/me' $ah)
Write-Host (Test-Endpoint 'GET /me (student)' 'GET' '/auth/me' $sh)

Write-Host ""
Write-Host "=== ADMIN ==="
Write-Host (Test-Endpoint 'GET /admin/config' 'GET' '/admin/config' $ah)
Write-Host (Test-Endpoint 'GET /admin/analytics' 'GET' '/admin/analytics' $ah)
Write-Host (Test-Endpoint 'GET /admin/faculty' 'GET' '/admin/faculty' $ah)
Write-Host (Test-Endpoint 'GET /admin/students' 'GET' '/admin/students' $ah)
Write-Host (Test-Endpoint 'GET /admin/alumni' 'GET' '/admin/alumni' $ah)
Write-Host (Test-Endpoint 'GET /admin/notices' 'GET' '/admin/notices' $ah)
Write-Host (Test-Endpoint 'POST /admin/config' 'POST' '/admin/config' $ah '{"active_semester_type":"ODD","start_date":"2024-07-01","end_date":"2024-11-30"}')
Write-Host (Test-Endpoint 'POST /admin/seating' 'POST' '/admin/seating' $ah '{"classrooms":[{"room":"101","capacity":30}]}')

Write-Host ""
Write-Host "=== HOD ==="
Write-Host (Test-Endpoint 'GET /hod/faculty' 'GET' '/hod/faculty' $hh)
Write-Host (Test-Endpoint 'GET /hod/analytics' 'GET' '/hod/analytics' $hh)
Write-Host (Test-Endpoint 'GET /hod/grievances' 'GET' '/hod/grievances' $hh)
Write-Host (Test-Endpoint 'GET /hod/notices' 'GET' '/hod/notices' $hh)
Write-Host (Test-Endpoint 'GET /hod/subjects' 'GET' '/hod/subjects' $hh)
Write-Host (Test-Endpoint 'GET /hod/leave-log' 'GET' '/hod/leave-log' $hh)

Write-Host ""
Write-Host "=== CLASS INCHARGE ==="
Write-Host (Test-Endpoint 'GET /class-incharge/analytics' 'GET' '/class-incharge/analytics' $cih)
Write-Host (Test-Endpoint 'GET /class-incharge/at-risk' 'GET' '/class-incharge/at-risk' $cih)
Write-Host (Test-Endpoint 'GET /class-incharge/students' 'GET' '/class-incharge/students' $cih)
Write-Host (Test-Endpoint 'GET /class-incharge/progression' 'GET' '/class-incharge/progression' $cih)
Write-Host (Test-Endpoint 'GET /class-incharge/notices' 'GET' '/class-incharge/notices' $cih)

Write-Host ""
Write-Host "=== SUBJECT INCHARGE ==="
Write-Host (Test-Endpoint 'GET /subject-incharge/subjects' 'GET' '/subject-incharge/subjects' $sih)
Write-Host (Test-Endpoint 'GET /subject-incharge/active-slot' 'GET' '/subject-incharge/active-slot' $sih)

Write-Host ""
Write-Host "=== TEACHER GUARDIAN ==="
Write-Host (Test-Endpoint 'GET /teacher-guardian/mentees' 'GET' '/teacher-guardian/mentees' $tgh)
Write-Host (Test-Endpoint 'GET /teacher-guardian/grievances' 'GET' '/teacher-guardian/grievances' $tgh)
Write-Host (Test-Endpoint 'GET /teacher-guardian/notices' 'GET' '/teacher-guardian/notices' $tgh)

Write-Host ""
Write-Host "=== STUDENT ==="
Write-Host (Test-Endpoint 'GET /student/dashboard' 'GET' '/student/dashboard' $sh)
Write-Host (Test-Endpoint 'GET /student/timetable' 'GET' '/student/timetable' $sh)
Write-Host (Test-Endpoint 'GET /student/faculty-locator' 'GET' '/student/faculty-locator' $sh)
Write-Host (Test-Endpoint 'GET /student/grievances' 'GET' '/student/grievances' $sh)
Write-Host (Test-Endpoint 'GET /student/notices' 'GET' '/student/notices' $sh)
Write-Host (Test-Endpoint 'GET /student/lab-marks' 'GET' '/student/lab-marks' $sh)
