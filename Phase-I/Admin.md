📊 1. Global Configuration & Governance

The Admin defines the foundational rules and operational context that govern all other modules.  

    Global Semester Configuration: Sets the active semester type (ODD/EVEN) and universal start/end dates that drive all timetable and attendance logic.  

    Threshold Definition: Defines college-wide global thresholds, such as the maximum AICTE points a student can earn or minimum attendance requirements.  

    Batch Progression Control: Triggers the transition of the active semester, which automatically initiates batch progression and alumni automation.  

    Macro Analytics: Accesses high-level performance and attendance analytics for the entire college rather than a specific branch.  

🛠 2. Data Infrastructure & Management

The Admin is responsible for the bulk ingestion and structural integrity of the platform's data.  

    Bulk CSV Ingestion: Manages the mass upload of data for students, faculty, the master timetable, and the semester planner.  

    Identity Management: Oversees the "Student Identity Protocol," ensuring all users adhere to the institutional Email and UID format.  

    System Architecture Maintenance: Manages the scalable full-stack infrastructure, including the Node.js backend and MySQL database.  

    Object Storage Oversight: Manages MinIO object storage for secure, scalable distribution of study materials and institutional notices.  

🔄 3. Advanced Administrative Modules

The Admin manages complex algorithmic features that automate campus-wide logistics.  

    Exam Seating Matrix: Inputs classroom capacities and schedules into a constraint-satisfaction algorithm to generate seating charts.  

    Invigilation Matrix: Oversees the auto-assignment of faculty to exam supervision duties to ensure equitable workload distribution.  

    Grievance Triage Oversight: Monitors the routing of institutional and infrastructure-related grievances (e.g., fee concerns or civil issues) to the correct authorities.  

    AI Notice Generation: Utilizes Gemini AI to draft formal institutional notices, such as low-attendance warnings, for instant PDF distribution.  

🎓 4. Alumni & Lifecycle Automation

The Admin manages the final transition of the student lifecycle within the ERP.  

    Alumni Transition: Oversees the automated movement of students who have completed Semester 8 to the Alumni section.  

    Institutional Reporting: Accesses archived alumni records, final CGPAs, and placement data for long-term institutional reporting.  

    Access Revocation: Manages the protocol that transitions graduate access from active features (like timetables) to read-only transcript views.