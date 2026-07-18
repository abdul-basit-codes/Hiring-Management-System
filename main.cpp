#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
#include <fstream>
#include <sstream>
using namespace std;


const string JOBS_FILE = "jobs.txt";
const string APPLICATIONS_FILE = "applications.txt";
const string RECRUITERS_FILE = "recruiters.txt";
const string CANDIDATES_FILE = "candidates.txt";


void separator() { cout << endl << string(55, '=') << endl; }
void pause() { cout << endl << "Press Enter to continue..."; cin.ignore(); cin.get(); }


string encode(const string& s) {
    string r = s;
    for (char& c : r) if (c == '|') c = '\x01';
    return r;
}
string decode(const string& s) {
    string r = s;
    for (char& c : r) if (c == '\x01') c = '|';
    return r;
}


class Job {
private:
    static int idCounter;
    int    jobId;
    string title;
    string description;
    string location;
    double salary;
    bool   isOpen;

public:
    // Normal constructor (auto-increments ID)
    Job(string t, string d, string loc, double sal)
        : jobId(++idCounter), title(t), description(d),
        location(loc), salary(sal), isOpen(true) {
    }

    // File-load constructor (restores exact ID)
    Job(int id, string t, string d, string loc, double sal, bool open)
        : jobId(id), title(t), description(d),
        location(loc), salary(sal), isOpen(open) {
        if (id > idCounter) idCounter = id;   // keep counter ahead
    }

    int    getId()          const { return jobId; }
    string getTitle()       const { return title; }
    string getDescription() const { return description; }
    string getLocation()    const { return location; }
    double getSalary()      const { return salary; }
    bool   getIsOpen()      const { return isOpen; }
    void   closeJob() { isOpen = false; }

    void display() const {
        cout << endl << "  [Job ID: " << jobId << "] " << title
            << endl << "  Location   : " << location
            << endl << "  Salary     : PKR " << fixed << setprecision(0) << salary
            << endl << "  Status     : " << (isOpen ? "OPEN" : "CLOSED")
            << endl << "  Description: " << description << endl;
    }

    // Format: jobId|title|description|location|salary|isOpen|recruiterName
    string serialize(const string& recruiterName) const {
        ostringstream oss;
        oss << jobId << "|" << encode(title) << "|" << encode(description)
            << "|" << encode(location) << "|" << fixed << setprecision(2) << salary
            << "|" << isOpen << "|" << encode(recruiterName);
        return oss.str();
    }
};
int Job::idCounter = 0;

// ─── Application ─────────────────────────────────────────────────────────────
class Application {
private:
    static int idCounter;
    int    appId;
    int    jobId;
    string candidateName;
    string coverLetter;
    string status;

public:
    Application(int jId, string cName, string cl)
        : appId(++idCounter), jobId(jId),
        candidateName(cName), coverLetter(cl), status("Pending") {
    }

    // File-load constructor
    Application(int id, int jId, string cName, string cl, string st)
        : appId(id), jobId(jId), candidateName(cName),
        coverLetter(cl), status(st) {
        if (id > idCounter) idCounter = id;
    }

    int    getId()            const { return appId; }
    int    getJobId()         const { return jobId; }
    string getCandidateName() const { return candidateName; }
    string getStatus()        const { return status; }
    void   setStatus(string s) { status = s; }

    void display() const {
        cout << endl << "  [Application #" << appId << "]"
            << endl << "  Job ID     : " << jobId
            << endl << "  Candidate  : " << candidateName
            << endl << "  Status     : " << status
            << endl << "  Cover Note : " << coverLetter << endl;
    }

    // Format: appId|jobId|candidateName|coverLetter|status|recruiterName
    string serialize(const string& recruiterName) const {
        return to_string(appId) + "|" + to_string(jobId) + "|" +
            encode(candidateName) + "|" + encode(coverLetter) + "|" +
            encode(status) + "|" + encode(recruiterName);
    }
};
int Application::idCounter = 0;

// ─── Person / Recruiter / Candidate / Admin ──────────────────────────────────
class Person {
private:
    string email;
    string password;

protected:
    string name;
    int    age;

public:
    Person(string n, int a, string e, string pw)
        : name(n), age(a), email(e), password(pw) {
    }

    virtual ~Person() {}

    string getName()     const { return name; }
    int    getAge()      const { return age; }
    string getEmail()    const { return email; }
    string getPassword() const { return password; }   // needed for serialization

    bool checkPassword(const string& pw) const { return password == pw; }

    virtual void   displayInfo() const = 0;
    virtual string getRole()     const = 0;
};

class Recruiter : public Person {
private:
    string              company;
    vector<Job>         postedJobs;
    vector<Application> receivedApplications;

public:
    Recruiter(string n, int a, string e, string pw, string comp)
        : Person(n, a, e, pw), company(comp) {
    }

    void displayInfo() const override {
        cout << endl << "  --- Recruiter Profile ---"
            << endl << "  Name    : " << name
            << endl << "  Age     : " << age
            << endl << "  Email   : " << getEmail()
            << endl << "  Company : " << company << endl;
    }

    string getRole()    const override { return "Recruiter"; }
    string getCompany() const { return company; }

    void postJob() {
        string title, desc, loc;
        double salary;
        cin.ignore();
        cout << endl << "  Job Title    : "; getline(cin, title);
        cout << "  Description  : "; getline(cin, desc);
        cout << "  Location     : "; getline(cin, loc);
        cout << "  Salary (PKR) : "; cin >> salary;
        postedJobs.push_back(Job(title, desc, loc, salary));
        cout << "  Job posted successfully!" << endl;
    }

    void postJobDirect(string t, string d, string loc, double sal) {
        postedJobs.push_back(Job(t, d, loc, sal));
    }

    // Used during file load to restore a job with its original ID
    void addJobFromFile(const Job& j) { postedJobs.push_back(j); }

    void viewPostedJobs() const {
        if (postedJobs.empty()) { cout << endl << "  No jobs posted yet." << endl; return; }
        cout << endl << "  === Your Posted Jobs ===";
        for (const auto& job : postedJobs) job.display();
    }

    const vector<Job>& getJobs()         const { return postedJobs; }
    const vector<Application>& getApplications() const { return receivedApplications; }

    void receiveApplication(const Application& app) {
        receivedApplications.push_back(app);
    }

    void addApplicationFromFile(const Application& app) {
        receivedApplications.push_back(app);
    }

    void manageApplications() {
        if (receivedApplications.empty()) {
            cout << endl << "  No applications received yet." << endl; return;
        }
        cout << endl << "  === Received Applications ===";
        for (auto& app : receivedApplications) {
            app.display();
            int choice;
            cout << "  Update: 1=Accept  2=Reject  3=Skip: ";
            cin >> choice;
            if (choice == 1) { app.setStatus("Accepted"); cout << "  Accepted." << endl; }
            else if (choice == 2) { app.setStatus("Rejected"); cout << "  Rejected." << endl; }
            else                    cout << "  Skipped." << endl;
        }
    }

    // Format: name|age|email|password|company
    string serialize() const {
        return encode(name) + "|" + to_string(age) + "|" +
            encode(getEmail()) + "|" + encode(getPassword()) + "|" + encode(company);
    }
};

class Candidate : public Person {
private:
    string              skills;
    string              resumeSummary;
    vector<Application> myApplications;

public:
    Candidate(string n, int a, string e, string pw, string sk, string res)
        : Person(n, a, e, pw), skills(sk), resumeSummary(res) {
    }

    void displayInfo() const override {
        cout << endl << "  --- Candidate Profile ---"
            << endl << "  Name   : " << name
            << endl << "  Age    : " << age
            << endl << "  Email  : " << getEmail()
            << endl << "  Skills : " << skills
            << endl << "  Resume : " << resumeSummary << endl;
    }

    string getRole()   const override { return "Candidate"; }
    string getSkills() const { return skills; }

    void applyToJob(int jobId, const string& jobTitle) {
        string cover;
        cout << endl << "  Cover note for '" << jobTitle << "':" << endl << "  > ";
        cin.ignore();
        getline(cin, cover);
        myApplications.push_back(Application(jobId, name, cover));
        cout << "  Application submitted!" << endl;
    }

    void viewMyApplications() const {
        if (myApplications.empty()) {
            cout << endl << "  No applications yet." << endl; return;
        }
        cout << endl << "  === Your Applications ===";
        for (const auto& app : myApplications) app.display();
    }

    bool hasApplications() const { return !myApplications.empty(); }

    const Application& getLastApplication() const { return myApplications.back(); }

    void addApplicationFromFile(const Application& app) {
        myApplications.push_back(app);
    }

    // Format: name|age|email|password|skills|resumeSummary
    string serialize() const {
        return encode(name) + "|" + to_string(age) + "|" +
            encode(getEmail()) + "|" + encode(getPassword()) + "|" +
            encode(skills) + "|" + encode(resumeSummary);
    }
};

class Admin : public Person {
private:
    string adminCode;

public:
    Admin(string n, int a, string e, string pw, string code)
        : Person(n, a, e, pw), adminCode(code) {
    }

    void displayInfo() const override {
        cout << endl << "  --- Admin ---" << endl << "  Name: " << name << endl;
    }

    string getRole() const override { return "Admin"; }

    bool verifyCode(const string& code) const { return adminCode == code; }

    void viewAllUsers(const vector<Recruiter>& recs,
        const vector<Candidate>& cans) const {
        cout << endl << "  === All Recruiters (" << recs.size() << ") ===";
        for (const auto& r : recs) r.displayInfo();
        cout << endl << "  === All Candidates (" << cans.size() << ") ===";
        for (const auto& c : cans) c.displayInfo();
    }
};

// ─── HiringSystem ─────────────────────────────────────────────────────────────
class HiringSystem {
private:
    vector<Recruiter> recruiters;
    vector<Candidate> candidates;
    Admin             admin;

    // ── Lookup helpers ────────────────────────────────────────────────────────
    int findRecruiter(const string& name) const {
        for (int i = 0; i < (int)recruiters.size(); i++)
            if (recruiters[i].getName() == name) return i;
        return -1;
    }

    int findCandidate(const string& name) const {
        for (int i = 0; i < (int)candidates.size(); i++)
            if (candidates[i].getName() == name) return i;
        return -1;
    }

    // ── File I/O ──────────────────────────────────────────────────────────────

    // Split a '|'-delimited line into fields
    static vector<string> split(const string& line) {
        vector<string> fields;
        stringstream ss(line);
        string tok;
        while (getline(ss, tok, '|')) fields.push_back(decode(tok));
        return fields;
    }

    void saveRecruiters() const {
        ofstream f(RECRUITERS_FILE);
        if (!f) { cerr << "  [Error] Cannot write " << RECRUITERS_FILE << endl; return; }
        for (const auto& r : recruiters) f << r.serialize() << "\n";
        cout << "  [File] Recruiters saved." << endl;
    }

    void saveCandidates() const {
        ofstream f(CANDIDATES_FILE);
        if (!f) { cerr << "  [Error] Cannot write " << CANDIDATES_FILE << endl; return; }
        for (const auto& c : candidates) f << c.serialize() << "\n";
        cout << "  [File] Candidates saved." << endl;
    }

    void saveJobs() const {
        ofstream f(JOBS_FILE);
        if (!f) { cerr << "  [Error] Cannot write " << JOBS_FILE << endl; return; }
        for (const auto& rec : recruiters)
            for (const auto& job : rec.getJobs())
                f << job.serialize(rec.getName()) << "\n";
        cout << "  [File] Jobs saved." << endl;
    }

    void saveApplications() const {
        ofstream f(APPLICATIONS_FILE);
        if (!f) { cerr << "  [Error] Cannot write " << APPLICATIONS_FILE << endl; return; }
        // Save from recruiters (the authoritative copy for status updates)
        for (const auto& rec : recruiters)
            for (const auto& app : rec.getApplications())
                f << app.serialize(rec.getName()) << "\n";
        cout << "  [File] Applications saved." << endl;
    }

    void loadRecruiters() {
        ifstream f(RECRUITERS_FILE);
        if (!f) return;   // first run — no file yet
        string line;
        while (getline(f, line)) {
            if (line.empty()) continue;
            auto fd = split(line);
            if (fd.size() < 5) continue;
            // fields: name|age|email|password|company
            recruiters.push_back(Recruiter(fd[0], stoi(fd[1]), fd[2], fd[3], fd[4]));
        }
        cout << "  [File] Recruiters loaded (" << recruiters.size() << ")." << endl;
    }

    void loadCandidates() {
        ifstream f(CANDIDATES_FILE);
        if (!f) return;
        string line;
        while (getline(f, line)) {
            if (line.empty()) continue;
            auto fd = split(line);
            if (fd.size() < 6) continue;
            // fields: name|age|email|password|skills|resumeSummary
            candidates.push_back(Candidate(fd[0], stoi(fd[1]), fd[2], fd[3], fd[4], fd[5]));
        }
        cout << "  [File] Candidates loaded (" << candidates.size() << ")." << endl;
    }

    void loadJobs() {
        ifstream f(JOBS_FILE);
        if (!f) return;
        string line;
        while (getline(f, line)) {
            if (line.empty()) continue;
            auto fd = split(line);
            if (fd.size() < 7) continue;
            // fields: jobId|title|description|location|salary|isOpen|recruiterName
            int    id = stoi(fd[0]);
            string title = fd[1], desc = fd[2], loc = fd[3];
            double salary = stod(fd[4]);
            bool   open = (fd[5] == "1");
            string rName = fd[6];

            int idx = findRecruiter(rName);
            if (idx == -1) continue;
            recruiters[idx].addJobFromFile(Job(id, title, desc, loc, salary, open));
        }
        cout << "  [File] Jobs loaded." << endl;
    }

    void loadApplications() {
        ifstream f(APPLICATIONS_FILE);
        if (!f) return;
        string line;
        while (getline(f, line)) {
            if (line.empty()) continue;
            auto fd = split(line);
            if (fd.size() < 6) continue;
            // fields: appId|jobId|candidateName|coverLetter|status|recruiterName
            int    appId = stoi(fd[0]);
            int    jobId = stoi(fd[1]);
            string cName = fd[2], cover = fd[3], status = fd[4], rName = fd[5];

            Application app(appId, jobId, cName, cover, status);

            int rIdx = findRecruiter(rName);
            if (rIdx != -1) recruiters[rIdx].addApplicationFromFile(app);

            int cIdx = findCandidate(cName);
            if (cIdx != -1) candidates[cIdx].addApplicationFromFile(app);
        }
        cout << "  [File] Applications loaded." << endl;
    }

    // Public save-all (called on exit and after each write operation)
    void saveAll() const {
        saveRecruiters();
        saveCandidates();
        saveJobs();
        saveApplications();
    }

    // ── Menus ────────────────────────────────────────────────────────────────
    void browseAllJobs() const {
        bool found = false;
        cout << endl << "  === All Open Jobs ===";
        for (const auto& rec : recruiters) {
            for (const auto& job : rec.getJobs()) {
                if (job.getIsOpen()) {
                    job.display();
                    cout << "  Posted by: " << rec.getName()
                        << " (" << rec.getCompany() << ")" << endl;
                    found = true;
                }
            }
        }
        if (!found) cout << endl << "  No open jobs right now." << endl;
    }

    void applyFlow(int cIdx) {
        browseAllJobs();
        cout << endl << "  Enter Job ID (0 to cancel): ";
        int jobId; cin >> jobId;
        if (jobId == 0) return;
        for (auto& rec : recruiters) {
            for (const auto& job : rec.getJobs()) {
                if (job.getId() == jobId && job.getIsOpen()) {
                    candidates[cIdx].applyToJob(jobId, job.getTitle());
                    rec.receiveApplication(candidates[cIdx].getLastApplication());
                    saveAll();   // persist immediately
                    return;
                }
            }
        }
        cout << endl << "  Job not found or closed." << endl;
    }

    void recruiterMenu(int idx) {
        int ch;
        do {
            separator();
            cout << "  RECRUITER — " << recruiters[idx].getName()
                << " | " << recruiters[idx].getCompany() << endl
                << string(55, '-') << endl
                << "  1. Post a New Job" << endl
                << "  2. View My Posted Jobs" << endl
                << "  3. Manage Applications" << endl
                << "  4. My Profile" << endl
                << "  0. Logout" << endl
                << string(55, '-') << endl << "  Choice: ";
            cin >> ch;
            switch (ch) {
            case 1: recruiters[idx].postJob();            saveAll(); break;
            case 2: recruiters[idx].viewPostedJobs();               break;
            case 3: recruiters[idx].manageApplications(); saveAll(); break;
            case 4: recruiters[idx].displayInfo();                  break;
            case 0: cout << endl << "  Logged out." << endl;        break;
            default: cout << "  Invalid." << endl;
            }
            if (ch != 0) pause();
        } while (ch != 0);
    }

    void candidateMenu(int idx) {
        int ch;
        do {
            separator();
            cout << "  CANDIDATE — " << candidates[idx].getName() << endl
                << string(55, '-') << endl
                << "  1. Browse All Jobs" << endl
                << "  2. Apply to a Job" << endl
                << "  3. My Applications" << endl
                << "  4. My Profile" << endl
                << "  0. Logout" << endl
                << string(55, '-') << endl << "  Choice: ";
            cin >> ch;
            switch (ch) {
            case 1: browseAllJobs();                      break;
            case 2: applyFlow(idx);                       break;
            case 3: candidates[idx].viewMyApplications(); break;
            case 4: candidates[idx].displayInfo();        break;
            case 0: cout << endl << "  Logged out." << endl; break;
            default: cout << "  Invalid." << endl;
            }
            if (ch != 0) pause();
        } while (ch != 0);
    }

    void adminMenu() {
        string code;
        cout << endl << "  Admin Code: "; cin >> code;
        if (!admin.verifyCode(code)) {
            cout << "  Access denied." << endl; return;
        }
        int ch;
        do {
            separator();
            cout << "  ADMIN PANEL" << endl
                << string(55, '-') << endl
                << "  1. View All Users" << endl
                << "  2. View All Jobs" << endl
                << "  0. Logout" << endl
                << string(55, '-') << endl << "  Choice: ";
            cin >> ch;
            switch (ch) {
            case 1: admin.viewAllUsers(recruiters, candidates); break;
            case 2: browseAllJobs();                            break;
            case 0: cout << endl << "  Admin logged out." << endl; break;
            }
            if (ch != 0) pause();
        } while (ch != 0);
    }

    void loginRecruiter() {
        string name, pw;
        cin.ignore();
        cout << endl << "  Name    : "; getline(cin, name);
        cout << "  Password: "; getline(cin, pw);
        int idx = findRecruiter(name);
        if (idx == -1 || !recruiters[idx].checkPassword(pw)) {
            cout << "  Invalid credentials." << endl; return;
        }
        recruiterMenu(idx);
    }

    void loginCandidate() {
        string name, pw;
        cin.ignore();
        cout << endl << "  Name    : "; getline(cin, name);
        cout << "  Password: "; getline(cin, pw);
        int idx = findCandidate(name);
        if (idx == -1 || !candidates[idx].checkPassword(pw)) {
            cout << "  Invalid credentials." << endl; return;
        }
        candidateMenu(idx);
    }

    void registerRecruiter() {
        string name, email, pw, company;
        int age;
        cin.ignore();
        cout << endl << "  Name    : "; getline(cin, name);
        cout << "  Age     : "; cin >> age; cin.ignore();
        cout << "  Email   : "; getline(cin, email);
        cout << "  Password: "; getline(cin, pw);
        cout << "  Company : "; getline(cin, company);
        recruiters.push_back(Recruiter(name, age, email, pw, company));
        saveAll();   // persist new user
        cout << "  Recruiter registered!" << endl;
    }

    void registerCandidate() {
        string name, email, pw, skills, resume;
        int age;
        cin.ignore();
        cout << endl << "  Name           : "; getline(cin, name);
        cout << "  Age            : "; cin >> age; cin.ignore();
        cout << "  Email          : "; getline(cin, email);
        cout << "  Password       : "; getline(cin, pw);
        cout << "  Skills         : "; getline(cin, skills);
        cout << "  Resume Summary : "; getline(cin, resume);
        candidates.push_back(Candidate(name, age, email, pw, skills, resume));
        saveAll();   // persist new user
        cout << "  Candidate registered!" << endl;
    }

    // Seed demo data only when no save files exist
    void seedDemoData() {
        recruiters.push_back(Recruiter("Ali Khan", 40, "ali@techcorp.pk", "pass123", "TechCorp Pakistan"));
        recruiters.push_back(Recruiter("Sara Malik", 38, "sara@nextsol.pk", "pass456", "NextSol Pvt Ltd"));

        candidates.push_back(Candidate("Abdul Basit", 22, "basit@gmail.com", "mypass",
            "Flutter, C++, Dart",
            "Final year NUTECH student, strong OOP"));
        candidates.push_back(Candidate("Usman Raza", 24, "usman@gmail.com", "mypass2",
            "Python, Django, SQL",
            "Backend dev, 1 year experience"));

        recruiters[0].postJobDirect("Flutter Developer",
            "Build cross-platform apps using Flutter & Dart", "Lahore", 85000);
        recruiters[0].postJobDirect("C++ Engineer",
            "OOP-based software design and systems programming", "Islamabad", 90000);
        recruiters[1].postJobDirect("UI/UX Designer",
            "Design interfaces in Figma for mobile and web", "Rawalpindi", 70000);

        saveAll();
        cout << "  [File] Demo data created and saved." << endl;
    }

public:
    HiringSystem()
        : admin("SuperAdmin", 35, "admin@hire.pk", "admin123", "ADMIN2024")
    {
        // Try to load from files; fall back to demo seed on first run
        ifstream probe(RECRUITERS_FILE);
        if (probe.good()) {
            probe.close();
            loadRecruiters();
            loadCandidates();
            loadJobs();
            loadApplications();
        }
        else {
            cout << "  [File] No save data found — loading demo data." << endl;
            seedDemoData();
        }
    }

    void run() {
        int ch;
        do {
            separator();
            cout << "  Hiring Management System  (C++)" << endl << endl
                << "  [Demo Recruiter] Name: Ali Khan    | Password: pass123" << endl
                << "  [Demo Recruiter] Name: Sara Malik  | Password: pass456" << endl
                << "  [Demo Candidate] Name: Abdul Basit | Password: mypass" << endl
                << "  [Demo Candidate] Name: Usman Raza  | Password: mypass2" << endl
                << "  [Admin Code] ADMIN2024" << endl << endl
                << string(55, '-') << endl
                << "  1. Login as Recruiter" << endl
                << "  2. Login as Candidate" << endl
                << "  3. Register as Recruiter" << endl
                << "  4. Register as Candidate" << endl
                << "  5. Admin Panel" << endl
                << "  0. Exit" << endl
                << string(55, '-') << endl << "  Choice: ";
            cin >> ch;
            switch (ch) {
            case 1: loginRecruiter();    break;
            case 2: loginCandidate();    break;
            case 3: registerRecruiter(); break;
            case 4: registerCandidate(); break;
            case 5: adminMenu();         break;
            case 0:
                saveAll();
                cout << endl << "  Goodbye!" << endl;
                break;
            default: cout << "  Invalid choice." << endl;
            }
            if (ch != 0) pause();
        } while (ch != 0);
    }
};

int main() {
    HiringSystem system;
    system.run();
    return 0;
}
