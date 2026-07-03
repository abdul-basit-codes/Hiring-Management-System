/**
 * HireFlow API Server
 * Bridges the C++ CSV data files to the frontend
 * Run: node server.js
 * Then open: http://localhost:3000
 */

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const url     = require('url');

const PORT    = 3000;
const DATA_DIR = path.join(__dirname, 'Project2');

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8').replace(/\r/g, '');
    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = splitCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const vals = splitCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
        return obj;
    }).filter(row => Object.values(row).some(v => v !== ''));
}

function splitCSVLine(line) {
    const fields = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
        else { cur += c; }
    }
    fields.push(cur);
    return fields;
}

// ── CSV Writer ────────────────────────────────────────────────────────────────
function q(v) {
    const s = String(v || '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCSV(filePath, headers, rows) {
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(headers.map(h => q(r[h] ?? '')).join(',')));
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

// ── Data Mappers ──────────────────────────────────────────────────────────────
function loadAll() {
    const recRaw  = parseCSV(path.join(DATA_DIR, 'recruiters.csv'));
    const candRaw = parseCSV(path.join(DATA_DIR, 'candidates.csv'));
    const jobsRaw = parseCSV(path.join(DATA_DIR, 'jobs.csv'));
    const appsRaw = parseCSV(path.join(DATA_DIR, 'applications.csv'));
    const bannedRaw = parseCSV(path.join(DATA_DIR, 'banned.csv'));
    const bannedEmails = new Set(bannedRaw.map(b => (b.Email || b.email || '').toLowerCase()));

    const recruiters = recRaw.map(r => ({
        name:    r.Name    || r.name    || '',
        age:     parseInt(r.Age || r.age) || 0,
        email:   r.Email   || r.email   || '',
        password:r.Password|| r.password|| '',
        company: r.Company || r.company || '',
        banned:  r.Banned  === '1' || bannedEmails.has((r.Email||'').toLowerCase())
    }));

    const candidates = candRaw.map(c => ({
        name:         c.Name          || c.name          || '',
        age:          parseInt(c.Age  || c.age) || 0,
        email:        c.Email         || c.email         || '',
        password:     c.Password      || c.password      || '',
        skills:       c.Skills        || c.skills        || '',
        resumeSummary:c.ResumeSummary || c.resumeSummary || '',
        banned:       c.Banned === '1' || bannedEmails.has((c.Email||'').toLowerCase())
    }));

    const jobs = jobsRaw.map(j => ({
        jobId:         parseInt(j.JobID    || j.jobId)   || 0,
        title:         j.Title             || j.title    || '',
        description:   j.Description       || j.description || '',
        location:      j.Location          || j.location || '',
        skills:        j.Skills            || j.skills   || '',
        salary:        parseFloat(j.Salary || j.salary)  || 0,
        isOpen:        (j.Status           || j.isOpen)  === 'Open' || j.isOpen === 'true' || j.isOpen === '1',
        applicantCount:parseInt(j.Applicants|| j.applicantCount) || 0,
        recruiterEmail:j.RecruiterEmail    || j.recruiterEmail || ''
    }));

    const applications = appsRaw.map(a => ({
        appId:          parseInt(a.AppID   || a.appId)   || 0,
        jobId:          parseInt(a.JobID   || a.jobId)   || 0,
        candidateName:  a.CandidateName    || a.candidateName  || '',
        candidateEmail: a.CandidateEmail   || a.candidateEmail || '',
        coverLetter:    a.CoverLetter      || a.coverLetter    || '',
        status:         a.Status           || a.status         || 'Pending',
        recruiterEmail: a.RecruiterEmail   || a.recruiterEmail || '',
        appliedAt:      a.AppliedAt        || a.appliedAt      || ''
    }));

    // Build notifications from accepted/hired/rejected apps
    const notifications = {};
    applications.forEach(a => {
        if (a.status !== 'Pending' && a.candidateEmail) {
            const email = a.candidateEmail;
            if (!notifications[email]) notifications[email] = [];
            const job = jobs.find(j => j.jobId === a.jobId);
            const title = job ? job.title : `Job #${a.jobId}`;
            const msg = a.status === 'Hired'
                ? `🎉 Congratulations! You have been HIRED for "${title}". Welcome aboard!`
                : a.status === 'Accepted'
                ? `✅ Your application for "${title}" has been Accepted!`
                : `Your application for "${title}" was not selected this time.`;
            if (!notifications[email].includes(msg)) notifications[email].push(msg);
        }
    });

    return { recruiters, candidates, jobs, applications, notifications };
}

// ── Save helpers ──────────────────────────────────────────────────────────────
function saveRecruiters(recruiters) {
    writeCSV(path.join(DATA_DIR, 'recruiters.csv'),
        ['Name','Age','Email','Password','Company','Banned'],
        recruiters.map(r => ({
            Name: r.name, Age: r.age, Email: r.email,
            Password: r.password, Company: r.company, Banned: r.banned ? '1' : '0'
        }))
    );
}
function saveCandidates(candidates) {
    writeCSV(path.join(DATA_DIR, 'candidates.csv'),
        ['Name','Age','Email','Password','Skills','ResumeSummary','Banned'],
        candidates.map(c => ({
            Name: c.name, Age: c.age, Email: c.email, Password: c.password,
            Skills: c.skills, ResumeSummary: c.resumeSummary, Banned: c.banned ? '1' : '0'
        }))
    );
}
function saveApplications(applications) {
    writeCSV(path.join(DATA_DIR, 'applications.csv'),
        ['AppID','JobID','CandidateName','CandidateEmail','CoverLetter','Status','RecruiterEmail','AppliedAt'],
        applications.map(a => ({
            AppID: a.appId, JobID: a.jobId, CandidateName: a.candidateName,
            CandidateEmail: a.candidateEmail, CoverLetter: a.coverLetter,
            Status: a.status, RecruiterEmail: a.recruiterEmail, AppliedAt: a.appliedAt
        }))
    );
}
function saveJobs(jobs) {
    writeCSV(path.join(DATA_DIR, 'jobs.csv'),
        ['JobID','Title','Description','Location','Skills','Salary','Status','Applicants','RecruiterEmail'],
        jobs.map(j => ({
            JobID: j.jobId, Title: j.title, Description: j.description,
            Location: j.location, Skills: j.skills, Salary: j.salary,
            Status: j.isOpen ? 'Open' : 'Closed', Applicants: j.applicantCount,
            RecruiterEmail: j.recruiterEmail
        }))
    );
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const MIME = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

// Rate limiter (in-memory, per IP)
const _rl = new Map();
function rateLimit(ip, key, max, windowMs) {
    const k = ip+':'+key, now = Date.now();
    const e = _rl.get(k) || {n:0, t:now};
    if (now - e.t > windowMs) { e.n=0; e.t=now; }
    e.n++; _rl.set(k, e);
    return e.n > max;
}
setInterval(()=>{ const c=Date.now()-900000; _rl.forEach((v,k)=>{ if(v.t<c) _rl.delete(k); }); }, 300000);

function json(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    const parsed  = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const method  = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // ── API Routes ────────────────────────────────────────────────────────────
    if (pathname.startsWith('/api/')) {

        // GET /api/db — full database snapshot
        if (method === 'GET' && pathname === '/api/db') {
            const d = loadAll();
            // Strip passwords from response — never send to client
            return json(res, 200, {
                ...d,
                candidates: d.candidates.map(({password,...c})=>c),
                recruiters:  d.recruiters.map(({password,...r})=>r),
                _live: true
            });
        }

        // POST /api/login — server-side auth (passwords never leave server)
        if (method === 'POST' && pathname === '/api/login') {
            const body = await readBody(req);
            const email = (body.email||'').trim().toLowerCase();
            const pw    = body.password||'';
            const role  = body.role||'';
            const d = loadAll();
            const list = role === 'Candidate' ? d.candidates : d.recruiters;
            const user = list.find(u=>(u.email||'').toLowerCase()===email||(u.name||'').toLowerCase()===email);
            if (!user || user.password !== pw) return json(res, 401, {error:'Invalid credentials.'});
            if (user.banned) return json(res, 403, {error:'Account banned. Contact administrator.'});
            const {password, ...safeUser} = user;
            return json(res, 200, {success:true, user:safeUser});
        }

        // POST /api/register — register new candidate or recruiter
        if (method === 'POST' && pathname === '/api/register') {
            const ip = req.socket.remoteAddress||'0';
            if (rateLimit(ip,'register',5,900000)) return json(res,429,{error:'Too many registrations. Try in 15 min.'});
            const body = await readBody(req);
            const db = loadAll();
            const allUsers = [...db.candidates, ...db.recruiters];
            const email = (body.email || '').trim().toLowerCase();
            if (allUsers.some(u => (u.email||'').trim().toLowerCase() === email)) {
                return json(res, 409, { error: 'Email already registered.' });
            }
            if (body.role === 'Candidate') {
                db.candidates.push({
                    name: body.name, age: body.age, email: body.email,
                    password: body.password, skills: body.skills || '',
                    resumeSummary: body.resumeSummary || '', banned: false
                });
                saveCandidates(db.candidates);
            } else {
                db.recruiters.push({
                    name: body.name, age: body.age, email: body.email,
                    password: body.password, company: body.company || '',
                    banned: false
                });
                saveRecruiters(db.recruiters);
            }
            return json(res, 200, { success: true });
        }

        // POST /api/apply — submit job application
        if (method === 'POST' && pathname === '/api/apply') {
            const body = await readBody(req);
            const db = loadAll();
            const job = db.jobs.find(j => j.jobId === body.jobId);
            if (!job || !job.isOpen) return json(res, 400, { error: 'Job not available.' });
            const already = db.applications.find(a => a.jobId === body.jobId && a.candidateEmail === body.candidateEmail);
            if (already) return json(res, 409, { error: 'Already applied to this job.' });
            const newId = (db.applications.reduce((m, a) => Math.max(m, a.appId), 0)) + 1;
            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
            db.applications.push({
                appId: newId, jobId: body.jobId,
                candidateName: body.candidateName, candidateEmail: body.candidateEmail,
                coverLetter: body.coverLetter || '', status: 'Pending',
                recruiterEmail: job.recruiterEmail, appliedAt: now
            });
            job.applicantCount++;
            saveApplications(db.applications);
            saveJobs(db.jobs);
            return json(res, 200, { success: true, appId: newId });
        }

        // POST /api/application/status — update application status
        if (method === 'POST' && pathname === '/api/application/status') {
            const body = await readBody(req);
            const db = loadAll();
            const app = db.applications.find(a => a.appId === body.appId);
            if (!app) return json(res, 404, { error: 'Application not found.' });
            app.status = body.status;
            if (body.status === 'Hired') {
                const job = db.jobs.find(j => j.jobId === app.jobId);
                if (job) job.isOpen = false;
                saveJobs(db.jobs);
            }
            saveApplications(db.applications);
            return json(res, 200, { success: true });
        }

        // POST /api/job — post a new job
        if (method === 'POST' && pathname === '/api/job') {
            const body = await readBody(req);
            const db = loadAll();
            const newId = (db.jobs.reduce((m, j) => Math.max(m, j.jobId), 0)) + 1;
            db.jobs.push({
                jobId: newId, title: body.title, description: body.description,
                location: body.location, skills: body.skills,
                salary: parseFloat(body.salary) || 0, isOpen: true,
                applicantCount: 0, recruiterEmail: body.recruiterEmail
            });
            saveJobs(db.jobs);
            return json(res, 200, { success: true, jobId: newId });
        }

        // PUT /api/job/:id/toggle — toggle job open/closed
        if (method === 'PUT' && /^\/api\/job\/\d+\/toggle$/.test(pathname)) {
            const jobId = parseInt(pathname.split('/')[3]);
            const db = loadAll();
            const job = db.jobs.find(j => j.jobId === jobId);
            if (!job) return json(res, 404, { error: 'Job not found.' });
            job.isOpen = !job.isOpen;
            saveJobs(db.jobs);
            return json(res, 200, { success: true, isOpen: job.isOpen });
        }

        // DELETE /api/job/:id
        if (method === 'DELETE' && /^\/api\/job\/\d+$/.test(pathname)) {
            const jobId = parseInt(pathname.split('/')[3]);
            const db = loadAll();
            db.jobs = db.jobs.filter(j => j.jobId !== jobId);
            saveJobs(db.jobs);
            return json(res, 200, { success: true });
        }

        // PUT /api/profile/candidate — update candidate profile
        if (method === 'PUT' && pathname === '/api/profile/candidate') {
            const body = await readBody(req);
            const db = loadAll();
            const c = db.candidates.find(c => c.email === body.email);
            if (!c) return json(res, 404, { error: 'Candidate not found.' });
            c.name = body.name || c.name;
            c.age  = body.age  || c.age;
            c.skills       = body.skills       !== undefined ? body.skills       : c.skills;
            c.resumeSummary= body.resumeSummary !== undefined ? body.resumeSummary: c.resumeSummary;
            saveCandidates(db.candidates);
            return json(res, 200, { success: true });
        }

        // PUT /api/profile/recruiter — update recruiter profile
        if (method === 'PUT' && pathname === '/api/profile/recruiter') {
            const body = await readBody(req);
            const db = loadAll();
            const r = db.recruiters.find(r => r.email === body.email);
            if (!r) return json(res, 404, { error: 'Recruiter not found.' });
            r.name    = body.name    || r.name;
            r.age     = body.age     || r.age;
            r.company = body.company || r.company;
            saveRecruiters(db.recruiters);
            return json(res, 200, { success: true });
        }

        // POST /api/admin/ban — ban/unban user
        if (method === 'POST' && pathname === '/api/admin/ban') {
            const body = await readBody(req);
            const db = loadAll();
            const cand = db.candidates.find(c => c.email === body.email);
            const rec  = db.recruiters.find(r => r.email === body.email);
            if (cand) { cand.banned = body.banned; saveCandidates(db.candidates); }
            if (rec)  { rec.banned  = body.banned; saveRecruiters(db.recruiters); }
            if (!cand && !rec) return json(res, 404, { error: 'User not found.' });
            return json(res, 200, { success: true });
        }

        // DELETE /api/admin/user — delete user
        if (method === 'DELETE' && pathname === '/api/admin/user') {
            const body = await readBody(req);
            const db = loadAll();
            db.candidates = db.candidates.filter(c => c.email !== body.email);
            db.recruiters = db.recruiters.filter(r => r.email !== body.email);
            saveCandidates(db.candidates);
            saveRecruiters(db.recruiters);
            return json(res, 200, { success: true });
        }

        return json(res, 404, { error: 'API route not found.' });
    }

    // ── Static File Server ────────────────────────────────────────────────────
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        return json(res, 403, { error: 'Forbidden' });
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found: ' + pathname);
        }
        const ext = path.extname(filePath);
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   HireFlow Server Running                ║');
    console.log('  ║                                          ║');
    console.log(`  ║   http://localhost:${PORT}                  ║`);
    console.log('  ║                                          ║');
    console.log('  ║   Reading CSV files from: Project2/      ║');
    console.log('  ║   Press Ctrl+C to stop                   ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
});
