/* =====================================================================
   iSKOLEKTIB - script.js
   An MVP prototype. Data (users, scholarships, applications and uploaded files) is kept in a
   SHARED Supabase database when config.js is filled in (otherwise in this browser only).
   Nothing is ever sent to a university, a scholarship provider, or a government agency.

   HOW THIS FILE IS ORGANIZED
     1. Settings and lists (courses, statuses, ...)
     2. Sample scholarship data
     3. Helper functions (dates, text, saving/loading)
     4. Scholarship matching logic        (Feature 1)
     5. Marketplace rendering             (Feature 2)
     6. Applications                      (Feature 3)
     7. Tracking & disbursement           (Feature 4)
     8. Dashboard
     8B. Sign-in, roles and admin scholarship management
     9. Navigation, modal, messages
    10. Click / change listeners and start-up
   ===================================================================== */


/* =====================================================================
   1. SETTINGS AND LISTS
   Edit these lists to change what appears in the dropdown menus.
   ===================================================================== */

// Key used to remember who is signed in (the data itself lives in the shared database)
const KEYS = { session: 'iskolektib_session' };

const COURSES = [
  'BS Agribusiness Economics', 'BA Anthropology', 'BA English', 'BS Applied Mathematics', 'BS Architecture',
  'BS Biology', 'BA Communication and Media Arts', 'BS Computer Science', 'BS Data Science',
  'BS Food Technology', 'AA Sport Science', 'B Sport Science'
];

const INTERESTS = [
  'College of Science & Mathematics', 'College of Humanities and Social Sciences', 'Department of Human Kinetics',
  'School of Management'
];

const YEARS = [1, 2, 3, 4, 5];

const AID_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'scholarship', label: 'Currently receiving another scholarship' },
  { value: 'assistance', label: 'Currently receiving financial assistance' }
];

const TYPES = ['Government', 'Private', 'University', 'Alumni'];

const APP_STATUSES = [
  'Draft', 'Submitted', 'Under Review', 'Verified', 'Incomplete', 'Approved', 'Rejected'
];

const DISB_STATUSES = ['Not Yet Approved', 'Pending', 'Processing', 'Released', 'Delayed'];

// An application can only be edited while it is in one of these statuses
const EDITABLE_STATUSES = ['Draft'];   // submitted applications are locked

const TIMELINE_STEPS = [
  'Application Submitted', 'Under Review', 'Approved', 'Disbursement Processing', 'Funds Released'
];

// Every scholarship income limit (maxIncome) is stored as an ANNUAL figure, because that is how the
// UP Mindanao scholarship list states it. This switch tells the matcher what the student types in the
// profile form: true  = the student enters MONTHLY family income (it is multiplied by 12 before comparing)
//                false = the student enters ANNUAL family income (compared as is)
// Make the label of the income field in your HTML say the same thing.
const INCOME_INPUT_IS_MONTHLY = true;


/* =====================================================================
   2. SCHOLARSHIP DATA (real UP Mindanao list)
   Deadlines are fixed ISO dates (YYYY-MM-DD). Where the source list gave no
   deadline, 2026-12-12 is used as a placeholder.
   Fields the source list did not state are left empty / null on purpose
   (maxGWA, maxIncome, compliance, renewal) rather than guessed.
   maxIncome is ANNUAL family gross income in PHP.
   "courses" must use the exact names in COURSES; "fields" must use the exact names in INTERESTS.
   Monthly stipends are converted to a per-semester figure using 5 months per semester.
   Records with published:false have no details in the source list yet.
   ===================================================================== */
function getSampleScholarships() {
  return [
    {
      id: 1, isSample: false, published: true,
      name: "Aboitiz Future Leaders' Scholarship",
      provider: 'Aboitiz',
      type: 'Private',
      description: 'Private scholarship for bona fide second-year undergraduate students of any degree program at UP Mindanao.',
      courses: ['Any'],
      yearLevels: [2],
      maxGWA: 2.0,
      maxIncome: 200000,
      fields: ['Any'],
      allowsExistingAid: false,
      benefits: 'PHP 10,000 monthly allowance; one-time Academic Excellence Incentive (PHP 20,000 for college valedictorian or equivalent recognition, or reimbursement of the same value); Latin Honors Incentive (Summa Cum Laude PHP 10,000, Magna Cum Laude PHP 7,000, Cum Laude PHP 5,000); Board Review Subsidy of PHP 15,000',
      benefitAmount: 50000,
      documents: [
        'Scholarship application form',
        'One 2x2 ID picture',
        'Birth certificate',
        'Form 5 (Certificate of Enrollment)',
        'Three recommendation letters from former professors (including a former professor of a major subject and of an English subject)',
        'Certified true copy of grades (all semesters taken)',
        'Certificate of Good Moral Character'
      ],
      deadline: '2026-12-12',
      instructions: 'Must be a bona fide second-year student at UP Mindanao with a CWA/GWA of 2.00 or better, enrolled in at least 15 units at the time of the awarding, annual family income not above PHP 200,000, and not a recipient of any other scholarship grant. Prepare all listed requirements and submit them with the application form.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 2, isSample: false, published: true,
      name: 'Adopt-a-Scholar',
      provider: 'UP Mindanao SFAS (donor-funded)',
      type: 'Private',
      description: 'Donor-funded student assistance that lets donors and benefactors support UP Mindanao undergraduate students who need financial assistance. A donor may name a student or choose beneficiaries by category (course preference, family income, SLAS result, grade requirement, year level). For category-based selection, SFAS may use SLAS portal information to find matching students.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: null,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'Donor-chosen allowance: Plate UP meal allowance (PHP 6,600 to 19,800 per semester), Live UP housing allowance (PHP 2,500 per semester), or Ride UP transportation allowance (PHP 5,500 per semester). Donors and beneficiaries may choose whether to reveal the donor\'s identity.',
      benefitAmount: 19800,
      documents: [],
      deadline: '2026-12-12',
      instructions: 'No application documents are listed. Matching depends on the donor\'s criteria; SFAS may identify students through the SLAS portal.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 3, isSample: false, published: true,
      name: 'Iskolar ng LANDBANK Program (ILP)',
      provider: 'LANDBANK Countryside Development Foundation, Inc.',
      type: 'Government',
      description: 'Public/government scholarship for 3rd and 4th year students of BS Agribusiness Economics, BS Food Technology, BS Data Science and BS Computer Science. Must be a qualified regular student with no record of conditional or failing grades and in good academic standing, a permanent resident of Davao del Sur, and not enjoying any other financial assistance, grant or scholarship.',
      courses: ['BS Agribusiness Economics', 'BS Food Technology', 'BS Data Science', 'BS Computer Science'],
      yearLevels: [3, 4],
      maxGWA: null,
      maxIncome: 300000,
      fields: ['School of Management', 'College of Science & Mathematics'],
      allowsExistingAid: false,
      benefits: 'Benefits are not stated in the scholarship list.',
      benefitAmount: 0,
      documents: [
        'Duly filled-out and signed ILP application form',
        'Certified True Copy of Grades from First Year College to the latest available grades',
        'Letter of Recommendation from the College Dean',
        'Endorsement letter from a LANDBANK agriculture-related client cooperative, organization or partner SUC, or other government agency',
        'PSA/NSO photocopy of birth certificate (temporary)',
        'Proof of registration to the RSBSA, or certification from the Municipal Agriculture Office (MAO), Municipal Agrarian Reform Office (MARO) or equivalent DA/DAR document',
        'Photocopy of recent ITR of parents, BIR Certificate of Tax Exemption, or Certificate of Indigency (annual family income not above PHP 300,000)',
        'Certificate of Good Moral Character from the College OSAS or equivalent office',
        'Barangay Clearance from the home barangay',
        'Valid medical certificate (SUC clinic or outside government/private clinic or hospital)',
        'Certification of Non-Enjoyment of Other Scholarship and Grant (signed by the SUC Head or Head of the Scholarship Office/Unit)',
        'Pre-recorded video (max 3 minutes): "Why I am pursuing my chosen course" and "How do I see myself for nation building?"'
      ],
      deadline: '2026-11-02',
      instructions: 'Submit the signed ILP application form with all eleven documents plus the pre-recorded video (maximum 3 minutes).',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 4, isSample: false, published: true,
      name: 'Sun Life Foundation Scholarship Program',
      provider: 'Sun Life Foundation',
      type: 'Private',
      description: 'Scholarship for 1st year BS Applied Mathematics and BS Computer Science students. Combined annual family gross income must not exceed PHP 500,000, and the applicant must be a permanent resident of Mindanao or Visayas.',
      courses: ['BS Applied Mathematics', 'BS Computer Science'],
      yearLevels: [1],
      maxGWA: null,
      maxIncome: 500000,
      fields: ['College of Science & Mathematics'],
      allowsExistingAid: true,
      benefits: 'Benefits are not stated in the scholarship list.',
      benefitAmount: 0,
      documents: [
        'Scholarship application form',
        'One 2x2 ID picture',
        'Three letters of recommendation from former teachers/professors or unit heads',
        'Certificate of Good Moral Character from your former school',
        'Form 5 (Certificate of Enrollment)',
        'Senior HS grades',
        'Parents\' proof of income: father\'s and mother\'s BIR 2316 for 2025, or other BIR income documents, or notarized affidavit of income for 2025 and 2026 (notarized affidavit of no income if unemployed, death certificate if deceased, proof or notarized affidavit of solo parent if applicable)',
        'Parents\' SALN',
        'Essay on life situation and plans in life, on A4 bond paper, at least 250 words'
      ],
      deadline: '2026-09-30',
      instructions: 'Compile all documents into one PDF file named "Surname, First Name", in the order listed. Barangay documents/certificates are no longer accepted.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 5, isSample: false, published: false,
      name: 'Student Learning Assistance System (SLAS)',
      provider: 'UP Mindanao',
      type: 'University',
      description: 'The scholarship list has no details for this program yet (type, target applicants, qualifications, requirements and deadline are blank). It stays unpublished until they are filled in.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: null,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'To be announced.',
      benefitAmount: 0,
      documents: [],
      deadline: '2026-12-12',
      instructions: 'Details to be announced.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 6, isSample: false, published: true,
      name: 'UP Mindanao Foundation, Inc. Scholarship',
      provider: 'UP Mindanao Foundation, Inc.',
      type: 'University',
      description: 'Scholarship for 4th-year students with limited slots: 3 slots for BS Biology (Christian applicants), 1 slot for Engineering or any related course, and 2 slots for any degree program. No other scholarship or grant upon application, and combined annual family gross income not above PHP 325,000.',
      courses: ['Any'],
      yearLevels: [4],
      maxGWA: null,
      maxIncome: 325000,
      fields: ['Any'],
      allowsExistingAid: false,
      benefits: 'Benefits are not stated in the scholarship list.',
      benefitAmount: 0,
      documents: [
        'UPMFI Scholarship Application Form',
        'Two 2x2 ID pictures',
        'SLAS Certification (SLAS bracket of FDS, FD or PD80 only)',
        'Certified True Copy of Grades of all semesters attended',
        'PSA Birth Certificate',
        'Form 5 (Certificate of Enrollment) - 2nd semester',
        'Parents\' proof of income: father\'s and mother\'s BIR 2316 for 2025, or other BIR income documents, or notarized affidavit of income for 2025 and 2026 (notarized affidavit of no income if unemployed, death certificate if deceased, proof or notarized affidavit of solo parent if applicable)',
        'Parents\' SALN 2024 and 2025 (if government employee)',
        'Current Certificate of Good Moral Character (from OSA)'
      ],
      deadline: '2026-08-30',
      instructions: 'Compile all documents into one PDF file named "Surname, First Name", in the order listed. Barangay documents/certificates are no longer accepted.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 7, isSample: false, published: true,
      name: 'PeSSA Scholarship Program',
      provider: 'Philippine Scholarships Sponsors Association (PeSSA)',
      type: 'Private',
      description: 'Scholarship for 1st year College of Science and Mathematics students of BS Applied Mathematics, BS Computer Science, BS Food Technology, BS Data Science and BS Biology. Combined annual family gross income must not exceed PHP 500,000.',
      courses: ['BS Applied Mathematics', 'BS Computer Science', 'BS Food Technology', 'BS Data Science', 'BS Biology'],
      yearLevels: [1],
      maxGWA: null,
      maxIncome: 500000,
      fields: ['College of Science & Mathematics'],
      allowsExistingAid: true,
      benefits: 'Benefits are not stated in the scholarship list.',
      benefitAmount: 0,
      documents: [
        'Scholarship application form',
        'One 2x2 ID picture',
        'PSA Birth Certificate',
        'Form 5 (Certificate of Enrollment)',
        'Parents\' proof of income: father\'s and mother\'s BIR 2316 for 2025, or other BIR income documents, or notarized affidavit of income for 2025 and 2026 (notarized affidavit of no income if unemployed, death certificate if deceased, proof or notarized affidavit of solo parent if applicable)',
        'Certified True Copy of Grades (SHS)',
        'Parents\' SALN (if applicable)'
      ],
      deadline: '2026-08-26',
      instructions: 'Compile all documents into one PDF file named "Surname, First Name", in the order listed. Barangay documents/certificates are no longer accepted.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 8, isSample: false, published: true,
      name: 'Move to Change Foundation Changemakers Scholarship Program',
      provider: 'Move to Change Foundation, Inc.',
      type: 'Private',
      description: 'Scholarship for 1st year students of BS Applied Mathematics, BS Food Technology, BS Computer Science, BS Biology, BA Anthropology, BA Communication and Media Arts, BS Architecture, BA English (Creative Writing), BS Agribusiness Economics, B Sport Science and BS Data Science. Combined annual family gross income must not exceed PHP 250,000.',
      courses: [
        'BS Applied Mathematics', 'BS Food Technology', 'BS Computer Science', 'BS Biology',
        'BA Anthropology', 'BA Communication and Media Arts', 'BS Architecture',
        'BA English', 'BS Agribusiness Economics', 'B Sport Science', 'BS Data Science'
      ],
      yearLevels: [1],
      maxGWA: null,
      maxIncome: 250000,
      fields: ['College of Science & Mathematics', 'College of Humanities and Social Sciences', 'School of Management', 'Department of Human Kinetics'],
      allowsExistingAid: true,
      benefits: 'Benefits are not stated in the scholarship list.',
      benefitAmount: 0,
      documents: [
        'Scholarship application form',
        'One 2x2 ID picture',
        'Notice of Admission (proof of admission to UP Mindanao)',
        'PSA Birth Certificate',
        'Form 5 (Certificate of Enrollment)',
        'Senior High School grades',
        'Parents\' proof of income: father\'s and mother\'s BIR 2316 for 2025, or BIR Certification of Income for 2025 and 2026, or notarized affidavit of income for 2025 and 2026 (notarized affidavit of no income if unemployed)',
        'Parents\' SALN 2025 (if government employee)',
        'Certificate of Good Moral Character from your high school',
        'Two letters of recommendation from former teachers, professors or guidance counselors'
      ],
      deadline: '2026-07-24',
      instructions: 'Compile all documents into one PDF file named "Surname, First Name", in the order listed.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 9, isSample: false, published: false,
      name: 'CHED Merit Scholarship Program (CMSP)',
      provider: 'Commission on Higher Education (CHED)',
      type: 'Government',
      description: 'The scholarship list has no details for this program yet (type, target applicants, qualifications, requirements and deadline are blank). It stays unpublished until they are filled in.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: null,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'To be announced.',
      benefitAmount: 0,
      documents: [],
      deadline: '2026-12-12',
      instructions: 'Details to be announced.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 10, isSample: false, published: false,
      name: 'Scholarship Program for Coconut Farmers and Their Families (CoScho)',
      provider: 'To be confirmed',
      type: 'Government',
      description: 'The scholarship list has no details for this program yet (type, target applicants, qualifications, requirements and deadline are blank). It stays unpublished until they are filled in.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: null,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'To be announced.',
      benefitAmount: 0,
      documents: [],
      deadline: '2026-12-12',
      instructions: 'Details to be announced.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 11, isSample: false, published: true,
      name: 'DOST Scholarship Program',
      provider: 'Department of Science and Technology (DOST)',
      type: 'Government',
      description: 'Scholarship for natural-born Filipino citizens who are Grade 12 students under the STEM track. Non-STEM Grade 12 students must belong to the upper 5% of the graduating class. High school graduates from before the K-12 program must not have earned any post-secondary university units and must also be in the upper 5% of their high school graduating class.',
      courses: ['Any'],
      yearLevels: [1],
      maxGWA: null,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'PHP 8,000 monthly living allowance; PHP 5,000 semestral book allowance; PHP 10,000 thesis allowance; PHP 1,000 graduation allowance',
      benefitAmount: 45000,
      documents: [],
      deadline: '2026-12-12',
      instructions: 'No application documents are listed. Check the eligibility rules in the description before applying.',
      link: '',
      compliance: [],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 12, isSample: false, published: true,
      name: 'UPAA LEAP',
      provider: 'UP Alumni Association',
      type: 'Alumni',
      description: 'Stipend for academically capable, financially constrained undergraduate students who can contribute positively to the UP community. Preferably 4th year level and the first in the family to finish a tertiary degree.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: 2.0,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'PHP 3,000 monthly stipend',
      benefitAmount: 15000,
      documents: [
        'Parental or personal income documentation showing financial need',
        'Document showing good moral character'
      ],
      deadline: '2026-12-12',
      instructions: 'Show financial need through parental or personal income documentation. Good moral character is required. 4th-year students and first-generation college graduates are preferred.',
      link: '',
      compliance: ['Maintain a GWA of 2.00 or better with no grade below 3.00'],
      renewal: 'Not stated in the scholarship list.'
    },
    {
      id: 13, isSample: false, published: true,
      name: 'UPSTREAM Scholarship Program',
      provider: 'University of the Philippines',
      type: 'University',
      description: 'Scholarship providing a monthly living allowance plus a transportation and miscellaneous expense allowance. Applicants are interviewed.',
      courses: ['Any'],
      yearLevels: [1, 2, 3, 4, 5],
      maxGWA: null,
      maxIncome: null,
      fields: ['Any'],
      allowsExistingAid: true,
      benefits: 'PHP 3,000 monthly living allowance plus PHP 500 monthly transportation and other miscellaneous expense allowance',
      benefitAmount: 17500,
      documents: [
        'Accomplished UPSTREAM application form',
        'TCG certified by the College Secretary',
        'BIR Certification (no income), or ITR for the past 2 years, or Barangay Certification',
        'Two recommendations: one from a professor/instructor and one from SOABE',
        'Copy of Form 5',
        'One-page essay on your life situation and goals in life, encoded, 300 to 400 words',
        'Monthly electricity billing for the last 3 months'
      ],
      deadline: '2026-12-12',
      instructions: 'New applicants submit all listed documents and attend an interview. Continuing applicants submit a complete TCG certified by the College Secretary and a certificate of 20 hours of service.',
      link: '',
      compliance: ['Continuing applicants: certificate of 20 hours of service'],
      renewal: 'Continuing applicants submit a complete TCG certified by the College Secretary and a certificate of 20 hours of service.'
    }
  ];
}


/* =====================================================================
   3. HELPER FUNCTIONS
   ===================================================================== */

// ----- The "state" of the app -----
let scholarships = [];
let applications = [];
let profile = null;
let session = null;               // who is signed in: { role: 'student' or 'admin', name, email }
let currentUser = null;           // the saved account of the signed-in person (from the users table)
let dbError = '';                 // message shown when the shared database cannot be reached
let pendingAnnouncement = null;   // admin: announcement PDF attached to the open scholarship form
let announcementFile = null;      // admin: PDF chosen in the upload box
let reviewingAppId = null;        // admin: application being reviewed
let editingScholarshipId = null;  // admin: id of the scholarship being edited (null = adding a new one)
let editingAppId = null;      // id of the application being edited (null = creating a new one)
let matchingShown = false;    // true after the user clicked "Find Matching Scholarships"
let toastTimer = null;

// ----- Short names for common things -----
function $(id) { return document.getElementById(id); }
function val(id) { return $(id).value; }

// Makes text safe to put inside HTML (protects against typed-in HTML tags)
function esc(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// "Under Review" -> "under-review" (used for CSS class names)
function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function peso(amount) { return 'PHP ' + Number(amount).toLocaleString('en-US'); }

function yearLabel(n) { return ['', '1st', '2nd', '3rd', '4th', '5th'][n] + ' year'; }

function aidLabel(value) {
  const found = AID_OPTIONS.find(function (o) { return o.value === value; });
  return found ? found.label : value;
}

// ----- Dates (stored as "YYYY-MM-DD" text) -----
function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayISO() { return toISO(new Date()); }
function dateInDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return toISO(d); }
function parseISO(s) { const p = s.split('-'); return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])); }

// Days from today until the date (negative = already passed)
function daysUntil(s) { return Math.round((parseISO(s) - parseISO(todayISO())) / 86400000); }

function formatDate(s) {
  if (!s) return 'Not set';
  return parseISO(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function isClosed(s) { return !!s.deadline && daysUntil(s.deadline) < 0; }

function deadlineBadge(deadline) {
  if (!deadline) return '<span class="badge badge-gray">No deadline</span>';
  const d = daysUntil(deadline);
  if (d < 0) return '<span class="badge badge-red">Closed</span>';
  if (d === 0) return '<span class="badge badge-amber">Due today</span>';
  if (d <= 7) return '<span class="badge badge-amber">' + d + ' day' + (d === 1 ? '' : 's') + ' left</span>';
  return '<span class="badge badge-blue">' + d + ' days left</span>';
}

function statusBadge(status) { return '<span class="badge status-' + slug(status) + '">' + esc(status) + '</span>'; }
function disbBadge(status) { return '<span class="badge disb-' + slug(status) + '">' + esc(status) + '</span>'; }

// ----- Finding things in the arrays -----
function findScholarship(id) { return scholarships.find(function (s) { return s.id === id; }); }
function findApp(id) { return applications.find(function (a) { return a.id === id; }); }
function newAppId() { return applications.reduce(function (max, a) { return Math.max(max, a.id); }, 0) + 1; }

// ----- Browser storage helpers (used for the sign-in session and for Local Demo Mode) -----
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;   // if the saved text is damaged, start fresh instead of crashing
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    showToast('Could not save to this browser (storage may be blocked or full).', 'error');
    return false;
  }
}

/* ---------------------------------------------------------------------
   SHARED DATA LAYER
   Cloud mode  : Supabase (a free hosted database + file storage). Every user
                 of the app reads and writes the SAME data.   (see config.js)
   Local mode  : if config.js is empty, data is kept in THIS browser only
                 (localStorage + IndexedDB) so the app still runs for testing.
   Three tables (users, scholarships, applications), each row = id + owner + data.
   Files (announcement PDFs, student documents) go to one storage bucket.
   --------------------------------------------------------------------- */
const CFG = window.ISKOLEKTIB_CONFIG || {};
const sb = (!CFG.LOCAL_DEMO_MODE && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
const BUCKET = 'iskolektib-files';
const LS_DB = 'iskolektib_db_';

function toRow(item) {
  const d = Object.assign({}, item);
  const id = d.id;
  delete d.id;
  return { id: id, owner: d.studentEmail || null, data: d };
}
function fromRow(r) { return Object.assign({}, r.data, { id: r.id }); }
function lsTable(t) { return loadJSON(LS_DB + t, {}); }

function idbOpen() {
  return new Promise(function (resolve, reject) {
    const r = indexedDB.open('iskolektib_files', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('files'); };
    r.onsuccess = function () { resolve(r.result); };
    r.onerror = function () { reject(r.error); };
  });
}
async function idbDo(mode, fn) {
  const d = await idbOpen();
  return new Promise(function (resolve, reject) {
    const tx = d.transaction('files', mode);
    const rq = fn(tx.objectStore('files'));
    tx.oncomplete = function () { resolve(rq ? rq.result : undefined); };
    tx.onerror = function () { reject(tx.error); };
  });
}

const store = {
  async list(t, owner) {
    if (sb) {
      let q = sb.from(t).select('id,owner,data');
      if (owner) q = q.eq('owner', owner);
      const res = await q;
      if (res.error) throw res.error;
      return res.data.map(fromRow);
    }
    return Object.values(lsTable(t)).filter(function (r) { return !owner || r.owner === owner; }).map(fromRow);
  },
  async get(t, id) {
    if (sb) {
      const res = await sb.from(t).select('id,owner,data').eq('id', id).maybeSingle();
      if (res.error) throw res.error;
      return res.data ? fromRow(res.data) : null;
    }
    const r = lsTable(t)[id];
    return r ? fromRow(r) : null;
  },
  // insertOnly = true makes a duplicate id fail (used to keep one account per email)
  async put(t, item, insertOnly) {
    const row = toRow(item);
    if (sb) {
      const res = await (insertOnly ? sb.from(t).insert(row) : sb.from(t).upsert(row));
      if (res.error) { if (res.error.code === '23505') throw new Error('DUPLICATE'); throw res.error; }
      return;
    }
    const tb = lsTable(t);
    if (insertOnly && tb[row.id]) throw new Error('DUPLICATE');
    tb[row.id] = row;
    saveJSON(LS_DB + t, tb);
  },
  async del(t, id) {
    if (sb) { const res = await sb.from(t).delete().eq('id', id); if (res.error) throw res.error; return; }
    const tb = lsTable(t);
    delete tb[id];
    saveJSON(LS_DB + t, tb);
  },
  async upload(path, file) {
    if (sb) {
      const res = await sb.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
      if (res.error) throw res.error;
      return;
    }
    await idbDo('readwrite', function (s) { return s.put(file, path); });
  },
  async blob(path) {
    if (sb) {
      const res = await sb.storage.from(BUCKET).download(path);
      if (res.error) throw res.error;
      return res.data;
    }
    const b = await idbDo('readonly', function (s) { return s.get(path); });
    if (!b) throw new Error('File not found');
    return b;
  },
  async removeFiles(paths) {
    paths = paths.filter(Boolean);
    if (!paths.length) return;
    try {
      if (sb) { await sb.storage.from(BUCKET).remove(paths); return; }
      for (const p of paths) await idbDo('readwrite', function (s) { return s.delete(p); });
    } catch (e) { console.warn('Could not remove files', e); }
  }
};

// Runs a save and shows a message if it fails. Returns true/false.
async function safe(promise, msg) {
  try { await promise; return true; }
  catch (e) { console.error(e); showToast((msg || 'Could not save') + ': ' + (e.message || e), 'error'); return false; }
}
function persistUser() { return safe(store.put('users', currentUser), 'Could not save your profile'); }
function persistScholarship(s) { return safe(store.put('scholarships', s), 'Could not save the scholarship'); }
function persistApp(a) { return safe(store.put('applications', a), 'Could not save the application'); }
function saveProfile() { currentUser.profile = profile; persistUser(); }

// Loads everything this user is allowed to see from the shared database.
// Students: published scholarships + their OWN applications. Admin staff: everything.
async function refreshData() {
  if (!currentUser) return;
  try {
    let all = await store.list('scholarships');
    if (all.length === 0) {                       // first run: add the sample listings
      all = getSampleScholarships();
      await Promise.all(all.map(function (s) { return store.put('scholarships', s); }));
    }
    scholarships = isAdmin() ? all : all.filter(function (s) { return s.published !== false; });
    applications = await store.list('applications', isAdmin() ? null : currentUser.email);
    dbError = '';
  } catch (e) {
    console.error(e);
    dbError = 'Cannot reach the shared database (' + (e.message || e) + '). Showing the last data loaded.';
  }
  const banner = $('db-banner');
  if (banner) {
    banner.classList.toggle('hidden', !dbError);
    banner.textContent = dbError;
  }
}

// Fills a <select> dropdown. "items" can be plain text or {value, label} objects.
function fillSelect(id, items, placeholder) {
  let html = placeholder !== undefined ? '<option value="">' + esc(placeholder) + '</option>' : '';
  items.forEach(function (item) {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    html += '<option value="' + esc(value) + '">' + esc(label) + '</option>';
  });
  $(id).innerHTML = html;
}


/* =====================================================================
   4. FEATURE 1 - SCHOLARSHIP MATCHING
   Compares a student profile against one scholarship.
   Each requirement is checked with a simple if-statement. The result lists
   the requirements the student meets and the ones they do not meet.
   ===================================================================== */

// Annual family income of the student, in PHP, whatever the profile form collects
function annualIncomeOf(p) { return INCOME_INPUT_IS_MONTHLY ? p.income * 12 : p.income; }

function checkEligibility(s, p) {
  const criteria = [];   // each item: { ok: true/false, good: 'text', bad: 'text' }

  // Course / degree program
  if (!s.courses.includes('Any')) {
    criteria.push({
      ok: s.courses.includes(p.course),
      good: 'Your program (' + p.course + ') is on the eligible list.',
      bad: 'Open only to: ' + s.courses.join(', ') + '. Your program is ' + p.course + '.'
    });
  }

  // Year level (only checked when the scholarship does not accept every year)
  if (s.yearLevels.length < YEARS.length) {
    criteria.push({
      ok: s.yearLevels.includes(p.yearLevel),
      good: 'Your year level (' + yearLabel(p.yearLevel) + ') is eligible.',
      bad: 'Open only to: ' + s.yearLevels.map(yearLabel).join(', ') + '. You are in your ' + yearLabel(p.yearLevel) + '.'
    });
  }

  // GWA: in the UP grading system a LOWER number is BETTER (1.00 is the best).
  // So a required GWA of 1.75 or better means: student GWA <= 1.75.
  if (s.maxGWA !== null) {
    criteria.push({
      ok: p.gwa <= s.maxGWA,
      good: 'Your GWA of ' + p.gwa.toFixed(2) + ' meets the required ' + s.maxGWA.toFixed(2) + ' or better.',
      bad: 'Your GWA of ' + p.gwa.toFixed(2) + ' is not good enough. Required: ' + s.maxGWA.toFixed(2) + ' or better.'
    });
  }

  // Family income limit (scholarship limits are ANNUAL)
  if (s.maxIncome !== null) {
    const annual = annualIncomeOf(p);
    criteria.push({
      ok: annual <= s.maxIncome,
      good: 'Your annual family income (' + peso(annual) + ') is within the limit of ' + peso(s.maxIncome) + '.',
      bad: 'Your annual family income (' + peso(annual) + ') is above the limit of ' + peso(s.maxIncome) + '.'
    });
  }

  // Field of study / academic interest (College)
  if (!s.fields.includes('Any')) {
    criteria.push({
      ok: s.fields.includes(p.interest),
      good: 'Your college (' + p.interest + ') fits the scholarship focus.',
      bad: 'Focus areas: ' + s.fields.join(', ') + '. Your college is ' + p.interest + '.'
    });
  }

  // Scholarship / financial assistance status
  if (!s.allowsExistingAid) {
    criteria.push({
      ok: p.aid === 'none',
      good: 'You are not receiving another scholarship or assistance, as required.',
      bad: 'Not open to students who are already receiving another scholarship or financial assistance.'
    });
  }

  const metList = criteria.filter(function (c) { return c.ok; });
  const unmetList = criteria.filter(function (c) { return !c.ok; });
  const total = criteria.length;
  const score = total === 0 ? 100 : Math.round((metList.length / total) * 100);

  // Full match = nothing unmet. Partial match = at least half of the requirements met.
  let level = 'none';
  if (unmetList.length === 0) level = 'full';
  else if (score >= 50) level = 'partial';

  const met = metList.map(function (c) { return c.good; });
  if (total === 0) met.push('Open to all students. There are no specific requirements to compare.');

  return { met: met, unmet: unmetList.map(function (c) { return c.bad; }), score: score, level: level };
}

// Returns only scholarships that fully match (100% of requirements met).
// Open scholarships come first, then closed ones; each group is sorted by deadline.
function computeMatches(p) {
  const matches = [];
  scholarships.forEach(function (s) {
    if (s.published === false) return;   // skip unpublished listings
    const result = checkEligibility(s, p);
    if (result.level === 'full') matches.push({ scholarship: s, result: result });
  });
  matches.sort(function (a, b) {
    return (Number(isClosed(a.scholarship)) - Number(isClosed(b.scholarship))) ||
      (a.scholarship.deadline || '').localeCompare(b.scholarship.deadline || '');
  });
  return matches;
}

// Reads the profile form and checks it. Returns { ok, errors, profile }
function readProfileForm() {
  const errors = [];
  const name = val('p-name').trim();
  const course = val('p-course');
  const year = Number(val('p-year'));
  const gwaText = val('p-gwa').trim();
  const incomeText = val('p-income').trim();
  const aid = val('p-aid');
  const interest = val('p-interest');
  const gwa = Number(gwaText);
  const income = Number(incomeText);

  if (!name) errors.push('Student name is required.');
  if (!course) errors.push('Please select your course or degree program.');
  if (!year) errors.push('Please select your year level.');
  if (gwaText === '' || isNaN(gwa) || gwa < 1 || gwa > 5) errors.push('GWA must be a number from 1.00 to 5.00.');
  if (incomeText === '' || isNaN(income) || income < 0) errors.push('Family income must be a number (0 or higher).');
  if (!aid) errors.push('Please select your scholarship / financial assistance status.');
  if (!interest) errors.push('Please select your College.');

  return {
    ok: errors.length === 0,
    errors: errors,
    profile: { name: name, course: course, yearLevel: year, gwa: gwa, income: income, aid: aid, interest: interest }
  };
}

function fillProfileForm() {
  const p = profile || {};
  const u = currentUser || {};
  $('p-name').value = p.name || u.fullName || '';
  $('p-course').value = p.course || u.course || '';
  $('p-year').value = String(p.yearLevel || u.yearLevel || '');
  $('p-gwa').value = p.gwa !== undefined ? p.gwa : '';
  $('p-income').value = p.income !== undefined ? p.income : '';
  $('p-aid').value = p.aid || 'none';
  $('p-interest').value = p.interest || '';
}

function showProfileErrors(errors) {
  const box = $('profile-errors');
  if (errors.length === 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = '<strong>Please fix the following:</strong><ul>' +
    errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
  box.classList.remove('hidden');
}

// "Save Profile" button
function handleSaveProfile() {
  const result = readProfileForm();
  showProfileErrors(result.errors);
  if (!result.ok) { showToast('Profile not saved. Please check the form.', 'error'); return false; }
  profile = result.profile;
  saveProfile();
  renderAll();
  if (matchingShown) renderMatchingResults();   // keep results in sync with the new profile
  showToast('Profile saved.');
  return true;
}

// "Find Matching Scholarships" button
function handleFindMatches() {
  const result = readProfileForm();
  showProfileErrors(result.errors);
  if (!result.ok) { showToast('Please complete your profile first.', 'error'); return; }
  profile = result.profile;
  saveProfile();
  matchingShown = true;
  renderAll();
  renderMatchingResults();
  showToast('Profile saved and matches found.');
  $('matching-results').scrollIntoView({ behavior: 'smooth' });
}

function renderMatchingResults() {
  const box = $('matching-results');
  if (!profile) { box.innerHTML = ''; return; }

  const matches = computeMatches(profile);
  const published = scholarships.filter(function (s) { return s.published !== false; });
  const notMatching = published.length - matches.length;

  let html = '<h3 class="section-title">Matching Results for ' + esc(profile.name) + '</h3>';
  html += '<p class="results-summary">' + matches.length + ' full match' + (matches.length === 1 ? '' : 'es') + '. ' +
    notMatching + ' scholarship' + (notMatching === 1 ? '' : 's') +
    ' did not match all of your requirements.</p>';

  if (matches.length === 0) {
    html += '<div class="card"><p>No scholarships matched your profile. Try the Marketplace to browse all listings.</p></div>';
  } else {
    html += '<div class="card-grid">';
    matches.forEach(function (m) {
      const s = m.scholarship;
      const levelBadge = m.result.level === 'full'
        ? '<span class="badge badge-green">Full match</span>'
        : '<span class="badge badge-amber">Partial match</span>';

      html += '<div class="card">';
      html += '<div class="badges">' + levelBadge + '<span class="badge badge-gray">' + m.result.score + '% of requirements met</span>' + '</div>';
      html += schHeadHTML(s);
      html += '<p>Deadline: <strong>' + formatDate(s.deadline) + '</strong> ' + deadlineBadge(s.deadline) + '</p>';
      html += '<div class="reason-box">';
      html += '<h4>Why it matches</h4><ul class="ok">' +
        m.result.met.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      if (m.result.unmet.length > 0) {
        html += '<h4>Unmet requirements</h4><ul class="bad">' +
          m.result.unmet.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      }
      html += '</div>';
      html += '<div class="card-actions">' +
        '<button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View Details</button>' +
        applyButton(s) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }
  box.innerHTML = html;
}


/* =====================================================================
   5. FEATURE 2 - SCHOLARSHIP MARKETPLACE
   ===================================================================== */

function applyButton(s) {
  if (isAdmin()) return '<button class="btn btn-secondary btn-small" data-action="admin-edit" data-id="' + s.id + '">Edit listing</button>';
  if (isClosed(s)) return '<button class="btn btn-gold btn-small" disabled>Closed</button>';
  return '<button class="btn btn-gold btn-small" data-action="apply" data-id="' + s.id + '">Apply Now</button>';
}

function yearsText(list) {
  return list.length === YEARS.length ? 'All year levels' : list.map(yearLabel).join(', ');
}

// Applies the search box, the three filters, and the sort order
function getFilteredScholarships() {
  const search = val('m-search').trim().toLowerCase();
  const course = val('f-course');
  const year = Number(val('f-year'));
  const type = val('f-type');
  const sort = val('m-sort');

  let list = scholarships.filter(function (s) {
    if (s.published === false) return false;   // unpublished drafts are never shown in the Marketplace
    if (search && !(s.name.toLowerCase().includes(search) || s.provider.toLowerCase().includes(search))) return false;
    if (course && !(s.courses.includes('Any') || s.courses.includes(course))) return false;
    if (year && !s.yearLevels.includes(year)) return false;
    if (type && s.type !== type) return false;
    return true;
  });

  list.sort(function (a, b) {
    return sort === 'desc' ? (b.deadline || '').localeCompare(a.deadline || '') : (a.deadline || '').localeCompare(b.deadline || '');
  });
  return list;
}

function renderMarketplace() {
  const list = getFilteredScholarships();
  $('market-count').textContent = 'Showing ' + list.length + ' of ' + scholarships.filter(function (s) { return s.published !== false; }).length + ' published scholarships.';

  if (list.length === 0) {
    $('market-list').innerHTML = '<div class="card"><p>No scholarships match your search or filters.</p></div>';
    return;
  }

  $('market-list').innerHTML = list.map(function (s) {
    return '<div class="card">' +
      '<div class="badges"><span class="badge badge-gray">' + esc(s.type) + '</span>' +
      '</div>' +
      schHeadHTML(s) +
      '<p class="sch-desc">' + esc(s.description) + '</p>' +
      '<ul class="info-list">' +
        '<li><strong>Programs:</strong> ' + esc(s.courses.includes('Any') ? 'Any program' : s.courses.join(', ')) + '</li>' +
        '<li><strong>Year levels:</strong> ' + esc(yearsText(s.yearLevels)) + '</li>' +
        '<li><strong>Minimum GWA:</strong> ' + (s.maxGWA !== null ? s.maxGWA.toFixed(2) + ' or better' : 'No requirement') + '</li>' +
        '<li><strong>Family income:</strong> ' + (s.maxIncome !== null ? 'Up to ' + peso(s.maxIncome) + ' per year' : 'No requirement') + '</li>' +
        '<li><strong>Benefits:</strong> ' + esc(s.benefits) + '</li>' +
        '<li><strong>Deadline:</strong> ' + formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) + '</li>' +
      '</ul>' +
      '<div class="card-actions">' +
        '<button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View Details</button>' +
        applyButton(s) +
      '</div></div>';
  }).join('');
}

function clearFilters() {
  $('m-search').value = '';
  $('f-course').value = '';
  $('f-year').value = '';
  $('f-type').value = '';
  $('m-sort').value = 'asc';
  renderMarketplace();
}

// Opens the pop-up with the full details of one scholarship
function openDetails(id) {
  const s = findScholarship(id);
  if (!s) return;

  let html = '<div class="badges"><span class="badge badge-gray">' + esc(s.type) + '</span>' +
    (s.isSample ? '<span class="badge badge-sample">Sample demonstration data - not an official listing</span>' : '') + '</div>';
  html += '<div class="sch-head">' + logoHtml(s) + '<div><h3 id="modal-title">' + esc(s.name) + '</h3>' +
    '<div class="sch-provider">' + esc(s.provider) + '</div></div></div>';
  html += '<p>' + esc(s.description) + '</p>';

  html += '<div class="detail-section"><h4>Deadline</h4><p>' + formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) + '</p></div>';

  html += '<div class="detail-section"><h4>Eligibility</h4><ul class="info-list">' +
    '<li><strong>Programs:</strong> ' + esc(s.courses.includes('Any') ? 'Any program' : s.courses.join(', ')) + '</li>' +
    '<li><strong>Year levels:</strong> ' + esc(yearsText(s.yearLevels)) + '</li>' +
    '<li><strong>Field of study:</strong> ' + esc(s.fields.includes('Any') ? 'Any' : s.fields.join(', ')) + '</li>' +
    '<li><strong>Minimum GWA:</strong> ' + (s.maxGWA !== null ? s.maxGWA.toFixed(2) + ' or better' : 'No requirement') + '</li>' +
    '<li><strong>Annual family income:</strong> ' + (s.maxIncome !== null ? 'Up to ' + peso(s.maxIncome) : 'No requirement') + '</li>' +
    '<li><strong>Other scholarships / assistance:</strong> ' + (s.allowsExistingAid ? 'Allowed' : 'Not allowed') + '</li>' +
    '</ul></div>';

  html += '<div class="detail-section"><h4>Benefits</h4><p>' + esc(s.benefits) + '</p></div>';
  html += '<div class="detail-section"><h4>Required documents</h4>' +
    (s.documents.length ? '<ul>' + s.documents.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '<p class="muted">No documents are listed.</p>') +
    '</div>';
  html += '<div class="detail-section"><h4>How to apply</h4><p>' + esc(s.instructions) + '</p></div>';

  // If the logged-in student has a saved profile, show how they compare
  if (profile && !isAdmin()) {
    const r = checkEligibility(s, profile);
    const label = r.level === 'full' ? 'Full match' : (r.level === 'partial' ? 'Partial match' : 'Low match');
    html += '<div class="detail-section"><h4>Your eligibility check (' + label + ')</h4><div class="reason-box">' +
      '<ul class="ok">' + r.met.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      (r.unmet.length ? '<ul class="bad">' + r.unmet.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      '</div></div>';
  } else if (!isAdmin()) {
    html += '<div class="detail-section"><p class="muted">Save your profile in Scholarship Matching to see how you compare with these requirements.</p></div>';
  }

  html += '<div class="card-actions">' + applyButton(s);
  if (s.announcement) {
    html += '<button class="btn btn-secondary btn-small" data-action="view-announcement" data-path="' + esc(s.announcement.path) + '" data-name="' + esc(s.announcement.name) + '" data-type="application/pdf">View original announcement (PDF)</button>';
  }
  if (s.link && /^https?:\/\//i.test(s.link)) {
    html += '<a class="btn btn-secondary btn-small" href="' + esc(s.link) + '" target="_blank" rel="noopener">Open external page</a>';
  }
  html += '<button class="btn btn-ghost btn-small" data-action="close-modal">Close</button></div>';

  $('modal-body').innerHTML = html;
  $('modal').classList.remove('hidden');
}

function closeModal() { $('modal').classList.add('hidden'); }


/* =====================================================================
   6. FEATURE 3 - APPLICATION MANAGEMENT  (with document uploads + locking)
   Each application is an object like:
   { id, scholarshipId, scholarshipName, studentEmail, studentId, status,
     dateSubmitted, name, email, contact, course, yearLevel, gwa, income, statement,
     documents: [ { name, done, file: { name, type, size, path } or null } ],
     adminRemark, disbursement: { status, date, amount } }
   Only "Draft" applications can be edited. Once submitted they are locked.
   ===================================================================== */

const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_MB = 5;
const LOCKED_MESSAGE = 'Your application has been successfully submitted. Your submitted information and documents are now locked and can no longer be edited.';

let formDocs = [];        // the requirement rows of the open form: { name, file }
let formAppId = null;     // id of the application being filled in (used in file paths)
let saving = false;

// ----- File helpers (shared with the admin pages) -----
function extOf(name) { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
function mimeOf(name) { const e = extOf(name); return e === 'pdf' ? 'application/pdf' : (e === 'png' ? 'image/png' : 'image/jpeg'); }
function safeName(name) { return String(name).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80); }
function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

// Returns an error message, or '' if the file is acceptable
function validateFile(file) {
  if (!ALLOWED_EXT.includes(extOf(file.name))) return 'Only PDF, JPG, JPEG or PNG files are allowed.';
  if (file.type && !ALLOWED_MIME.includes(file.type)) return '"' + file.name + '" is not a valid PDF, JPG or PNG file.';
  if (file.size === 0) return '"' + file.name + '" is empty.';
  if (file.size > MAX_FILE_MB * 1024 * 1024) return '"' + file.name + '" is larger than ' + MAX_FILE_MB + ' MB.';
  return '';
}

function fileButtons(file) {
  const attrs = ' data-path="' + esc(file.path) + '" data-name="' + esc(file.name) + '" data-type="' + esc(file.type || mimeOf(file.name)) + '"';
  return '<button type="button" class="btn btn-secondary btn-small" data-action="file-preview"' + attrs + '>Preview</button>' +
    '<button type="button" class="btn btn-secondary btn-small" data-action="file-download"' + attrs + '>Download</button>';
}

function uploadBadge(file) {
  return file ? '<span class="badge badge-green">Uploaded</span>' : '<span class="badge badge-amber">Not Yet Uploaded</span>';
}

// Read-only list of requirements and their files (student cards and admin review)
function docsListHTML(docs) {
  if (!docs.length) return '<p class="muted">No documents are required for this scholarship.</p>';
  return '<div class="doc-list">' + docs.map(function (d) {
    return '<div class="doc-row"><div class="doc-main"><strong>' + esc(d.name) + '</strong> ' + uploadBadge(d.file) +
      (d.file ? '<div class="doc-file">' + esc(d.file.name) + ' (' + fmtSize(d.file.size) + ')</div>' : '') + '</div>' +
      '<div class="doc-actions">' + (d.file ? fileButtons(d.file) : '') + '</div></div>';
  }).join('') + '</div>';
}

// Shows a Blob/File in the preview window (images are shown, PDFs open in a frame)
let previewUrl = null;
function showPreview(blob, name, type) {
  closePreview();
  const typed = new Blob([blob], { type: type || mimeOf(name) });
  previewUrl = URL.createObjectURL(typed);
  const isPdf = (type || mimeOf(name)) === 'application/pdf';
  $('preview-body').innerHTML = '<h3>' + esc(name) + '</h3>' +
    (isPdf ? '<iframe class="preview-frame" src="' + previewUrl + '" title="PDF preview"></iframe>'
           : '<img class="preview-img" src="' + previewUrl + '" alt="' + esc(name) + '">') +
    '<div class="card-actions"><a class="btn btn-secondary btn-small" href="' + previewUrl + '" target="_blank" rel="noopener">Open in new tab</a>' +
    '<a class="btn btn-secondary btn-small" href="' + previewUrl + '" download="' + esc(name) + '">Download</a>' +
    '<button type="button" class="btn btn-ghost btn-small" data-action="close-preview">Close</button></div>';
  $('preview-modal').classList.remove('hidden');
}
function closePreview() {
  $('preview-modal').classList.add('hidden');
  $('preview-body').innerHTML = '';
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
}
async function previewStored(el) {
  try { showPreview(await store.blob(el.dataset.path), el.dataset.name, el.dataset.type); }
  catch (e) { showToast('Could not open the file: ' + (e.message || e), 'error'); }
}
async function downloadStored(el) {
  try { downloadBlob(await store.blob(el.dataset.path), el.dataset.name, el.dataset.type); }
  catch (e) { showToast('Could not download the file: ' + (e.message || e), 'error'); }
}
function downloadBlob(blob, name, type) {
  const url = URL.createObjectURL(new Blob([blob], { type: type || mimeOf(name) }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

// ----- Form helpers -----
function showAppForm(show) {
  $('app-list-view').classList.toggle('hidden', show);
  $('app-form-view').classList.toggle('hidden', !show);
}

function showFormErrors(errors) {
  const box = $('app-errors');
  if (errors.length === 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = '<strong>Please fix the following:</strong><ul>' +
    errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
  box.classList.remove('hidden');
}

function showAppFlash(message) {
  const box = $('app-flash');
  if (!message) { box.classList.add('hidden'); box.textContent = ''; return; }
  box.textContent = message;
  box.classList.remove('hidden');
}

// One upload row per requirement, plus a short info box for the chosen scholarship
function renderFormDocs() {
  const s = findScholarship(Number(val('af-scholarship')));
  if (!s) {
    $('af-docs').innerHTML = '<p class="muted">Choose a scholarship to see its required documents.</p>';
    $('af-scholarship-info').innerHTML = '';
    return;
  }
  $('af-docs').innerHTML = formDocs.length === 0 ? '<p class="muted">No documents are required for this scholarship.</p>' : formDocs.map(function (d, i) {
    return '<div class="doc-row"><div class="doc-main"><strong>' + esc(d.name) + '</strong> ' + uploadBadge(d.file) +
      '<div class="doc-file">' + (d.file ? esc(d.file.name) + ' (' + fmtSize(d.file.size) + ')' : 'PDF, JPG, JPEG or PNG, up to ' + MAX_FILE_MB + ' MB') + '</div></div>' +
      '<div class="doc-actions">' +
      '<label class="btn btn-primary btn-small file-btn">' + (d.file ? 'Replace file' : 'Choose file') +
        '<input type="file" class="file-input" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" data-action="doc-upload" data-index="' + i + '"></label>' +
      (d.file ? fileButtons(d.file) + '<button type="button" class="btn btn-danger btn-small" data-action="doc-remove" data-index="' + i + '">Remove</button>' : '') +
      '</div></div>';
  }).join('');

  $('af-scholarship-info').innerHTML = '<div class="alert alert-info"><strong>' + esc(s.provider) + '</strong> &middot; Deadline: ' +
    formatDate(s.deadline) + ' ' + deadlineBadge(s.deadline) + '<br>Benefits: ' + esc(s.benefits) +
    '<br>How to apply: ' + esc(s.instructions) + '</div>';
}

function setDocsFromScholarship() {
  const s = findScholarship(Number(val('af-scholarship')));
  formDocs = s ? s.documents.map(function (name) { return { name: name, file: null }; }) : [];
}

function openNewAppForm(prefilledId) {
  editingAppId = null;
  formAppId = Date.now();
  const openOnes = scholarships.filter(function (s) { return !isClosed(s); });
  fillSelect('af-scholarship', openOnes.map(function (s) { return { value: s.id, label: s.name }; }), 'Select a scholarship');
  $('af-scholarship').disabled = false;
  if (prefilledId) $('af-scholarship').value = String(prefilledId);

  // Personal details come from the saved account profile
  const u = currentUser || {};
  const p = profile || {};
  $('af-name').value = u.fullName || '';
  $('af-email').value = u.email || '';
  $('af-contact').value = '';
  $('af-course').value = p.course || u.course || '';
  $('af-year').value = String(p.yearLevel || u.yearLevel || '');
  $('af-gwa').value = p.gwa !== undefined ? p.gwa : '';
  $('af-income').value = p.income !== undefined ? p.income : '';
  $('af-statement').value = '';

  $('app-form-title').textContent = 'New Scholarship Application';
  setDocsFromScholarship();
  showFormErrors([]);
  renderFormDocs();
  showAppForm(true);
}

function openEditForm(app) {
  if (!app || app.status !== 'Draft') { showToast('This application is locked and can no longer be edited.', 'error'); return; }
  editingAppId = app.id;
  formAppId = app.id;
  fillSelect('af-scholarship', [{ value: app.scholarshipId, label: app.scholarshipName || 'Scholarship' }]);
  $('af-scholarship').value = String(app.scholarshipId);
  $('af-scholarship').disabled = true;   // the scholarship of an existing application cannot be changed

  $('af-name').value = app.name || '';
  $('af-email').value = app.email || currentUser.email;
  $('af-contact').value = app.contact || '';
  $('af-course').value = app.course || '';
  $('af-year').value = app.yearLevel ? String(app.yearLevel) : '';
  $('af-gwa').value = app.gwa !== '' && app.gwa !== undefined ? app.gwa : '';
  $('af-income').value = app.income !== '' && app.income !== undefined ? app.income : '';
  $('af-statement').value = app.statement || '';

  $('app-form-title').textContent = 'Edit Draft Application';
  formDocs = app.documents.map(function (d) { return { name: d.name, file: d.file || null }; });
  showFormErrors([]);
  renderFormDocs();
  showAppForm(true);
}

// Called by "Apply Now" buttons anywhere in the app
function startApplication(id) {
  if (isAdmin()) return;   // only students apply
  const s = findScholarship(id);
  if (!s) return;
  if (isClosed(s)) { showToast('The deadline for this scholarship has passed.', 'error'); return; }

  showPage('applications');
  const existing = applications.find(function (a) { return a.scholarshipId === id; });
  if (!existing) {
    openNewAppForm(id);
  } else if (existing.status === 'Draft') {
    openEditForm(existing);
    showToast('You already have a draft for this scholarship. Opening it.', 'info');
  } else {
    showToast('You already submitted an application for this scholarship (status: ' + existing.status + ').', 'info');
  }
}

function readAppForm() {
  return {
    scholarshipId: Number(val('af-scholarship')),
    name: val('af-name').trim(),
    email: val('af-email').trim(),
    contact: val('af-contact').trim(),
    course: val('af-course'),
    yearLevel: Number(val('af-year')),
    gwaText: val('af-gwa').trim(),
    incomeText: val('af-income').trim(),
    statement: val('af-statement').trim()
  };
}

// Returns a list of error messages (empty list = form is valid)
function validateAppForm(f, strict) {
  const errors = [];
  if (!f.scholarshipId) errors.push('Please choose a scholarship.');
  if (strict) {
    const gwa = Number(f.gwaText);
    const income = Number(f.incomeText);
    if (!f.name) errors.push('Full name is required.');
    if (!f.course) errors.push('Course / degree program is required.');
    if (!f.yearLevel) errors.push('Year level is required.');
    if (f.gwaText === '' || isNaN(gwa) || gwa < 1 || gwa > 5) errors.push('GWA must be a number from 1.00 to 5.00.');
    if (f.incomeText === '' || isNaN(income) || income < 0) errors.push('Family income must be a number (0 or higher).');
  }
  return errors;
}

// A student picked a file for one requirement: check it, then upload it
async function handleDocUpload(input) {
  const i = Number(input.dataset.index);
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || !formDocs[i]) return;
  const err = validateFile(file);
  if (err) { showToast(err, 'error'); return; }
  showToast('Uploading ' + file.name + '...', 'info');
  const path = 'applications/' + formAppId + '/' + i + '-' + Date.now() + '-' + safeName(file.name);
  try { await store.upload(path, file); }
  catch (e) { showToast('Upload failed: ' + (e.message || e), 'error'); return; }
  formDocs[i].file = { name: file.name, type: file.type || mimeOf(file.name), size: file.size, path: path };
  renderFormDocs();
  showToast('"' + file.name + '" uploaded for ' + formDocs[i].name + '.');
}

// mode is 'draft' (save draft) or 'submit' (final submission, which locks the application)
async function saveApplication(mode) {
  if (saving || !currentUser || isAdmin()) return;
  const f = readAppForm();
  const existing = editingAppId ? findApp(editingAppId) : null;
  if (existing && existing.status !== 'Draft') { showToast('This application is locked and can no longer be edited.', 'error'); return; }

  const errors = validateAppForm(f, mode === 'submit');
  const scholarship = findScholarship(f.scholarshipId);
  if (scholarship && mode === 'submit' && isClosed(scholarship)) {
    errors.push('The deadline for this scholarship has passed, so it cannot be submitted.');
  }
  if (f.scholarshipId && applications.some(function (a) { return a.scholarshipId === f.scholarshipId && a.id !== editingAppId; })) {
    errors.push('You already have an application for this scholarship.');
  }
  if (mode === 'submit') {
    formDocs.forEach(function (d) { if (!d.file) errors.push('Missing required document: ' + d.name + '. Please upload it.'); });
  }
  if (errors.length > 0) {
    showFormErrors(errors);
    showToast('Application not saved. Please fix the errors.', 'error');
    return;
  }

  if (mode === 'submit' && !confirm('Are you sure you want to submit this application?\n\nOnce submitted, your application and uploaded documents will be LOCKED and can no longer be edited, replaced or deleted.')) return;

  saving = true;
  const app = existing || {
    id: formAppId, status: 'Draft', dateSubmitted: '',
    disbursement: { status: 'Not Yet Approved', date: '', amount: scholarship.benefitAmount }
  };
  app.scholarshipId = f.scholarshipId;
  app.scholarshipName = scholarship.name;
  app.studentEmail = currentUser.email;
  app.studentId = currentUser.id;
  app.studentNumber = currentUser.studentNumber || '';
  app.name = f.name;
  app.email = currentUser.email;
  app.contact = f.contact;
  app.course = f.course;
  app.yearLevel = f.yearLevel;
  app.gwa = f.gwaText === '' ? '' : Number(f.gwaText);
  app.income = f.incomeText === '' ? '' : Number(f.incomeText);
  app.statement = f.statement;
  app.documents = formDocs.map(function (d) { return { name: d.name, done: !!d.file, file: d.file }; });
  if (mode === 'submit') {
    app.status = 'Submitted';
    app.dateSubmitted = todayISO();
    app.submittedAt = new Date().toISOString();
  }

  const ok = await persistApp(app);
  saving = false;
  if (!ok) { if (mode === 'submit') { app.status = 'Draft'; app.dateSubmitted = ''; } return; }
  if (!existing) applications.push(app);

  renderAll();
  showAppForm(false);
  editingAppId = null;
  if (mode === 'submit') { showAppFlash(LOCKED_MESSAGE); showToast('Application submitted and locked.'); }
  else { showAppFlash(''); showToast('Draft saved.'); }
  window.scrollTo(0, 0);
}

async function deleteApplication(id) {
  const app = findApp(id);
  if (!app) return;
  if (app.status !== 'Draft') { showToast('Submitted applications are locked and cannot be deleted.', 'error'); return; }
  if (!confirm('Delete your draft for "' + (app.scholarshipName || 'this scholarship') + '"? This cannot be undone.')) return;
  if (!(await safe(store.del('applications', id), 'Could not delete the draft'))) return;
  store.removeFiles(app.documents.map(function (d) { return d.file && d.file.path; }));
  applications = applications.filter(function (a) { return a.id !== id; });
  renderAll();
  showToast('Draft deleted.');
}

function renderApplications() {
  const box = $('app-list');
  if (applications.length === 0) {
    box.innerHTML = '<div class="card"><p>You have no applications yet.</p>' +
      '<p class="muted">Use "New Application" above, or click "Apply Now" on any scholarship in the Marketplace.</p></div>';
    return;
  }

  const sorted = applications.slice().sort(function (a, b) { return b.id - a.id; });

  box.innerHTML = sorted.map(function (app) {
    const s = findScholarship(app.scholarshipId) || { name: app.scholarshipName || 'Removed scholarship', provider: '-', deadline: '' };
    const isDraft = app.status === 'Draft';
    const missing = app.documents.filter(function (d) { return !d.file; });

    let html = '<div class="card app-card">';
    html += '<div class="app-head"><div><h4 class="sch-title">' + esc(s.name) + '</h4>' +
      '<div class="sch-provider">' + esc(s.provider) + '</div></div>' + statusBadge(app.status) + '</div>';

    html += '<div class="app-meta">' +
      '<div><span>Applicant</span>' + esc(app.name || '(no name yet)') + '</div>' +
      '<div><span>Date submitted</span>' + (app.dateSubmitted ? formatDate(app.dateSubmitted) : 'Not submitted yet') + '</div>' +
      '<div><span>Course and year</span>' + esc((app.course || '-') + (app.yearLevel ? ', ' + yearLabel(app.yearLevel) : '')) + '</div>' +
      '</div>';

    if (app.status === 'Incomplete') {
      html += '<div class="alert alert-warn"><strong>The reviewer marked your application as Incomplete.</strong>' +
        (app.adminRemark ? '<br>Reviewer note: ' + esc(app.adminRemark) : '') +
        '<br>For this prototype, submitted applications stay locked. Please contact the scholarship office.</div>';
    } else if (!isDraft && app.adminRemark) {
      html += '<div class="alert alert-info">Reviewer note: ' + esc(app.adminRemark) + '</div>';
    }
    html += approvalBox(app);
    html += '<div class="checklist"><h4>Uploaded requirements (' + (app.documents.length - missing.length) + ' of ' + app.documents.length + ')</h4>' +
      docsListHTML(app.documents) + '</div>';

    if (isDraft) {
      html += '<div class="alert alert-info">This is a draft. It has not been submitted yet' +
        (missing.length ? ' and ' + missing.length + ' document(s) are still missing.' : '.') + '</div>';
    } else {
      html += '<div class="alert alert-ok">&#128274; Locked. Your submitted information and documents can no longer be edited, replaced or deleted.</div>';
    }

    html += '<div class="card-actions">' +
      (isDraft
        ? '<button class="btn btn-secondary btn-small" data-action="edit-app" data-id="' + app.id + '">Edit / Submit</button>' +
          '<button class="btn btn-danger btn-small" data-action="delete-app" data-id="' + app.id + '">Delete draft</button>'
        : '<button class="btn btn-secondary btn-small" disabled>Locked</button>') + '</div>';
    html += '</div>';
    return html;
  }).join('');
}

/* =====================================================================
   7. FEATURE 4 - TRACKING & DISBURSEMENT
   Everything here is entered manually. The app cannot check real fund releases.
   ===================================================================== */

// Works out the state of each of the 5 timeline steps: done / current / delayed / todo
function getTimeline(app) {
  const states = ['todo', 'todo', 'todo', 'todo', 'todo'];
  const d = app.disbursement.status;
  states[0] = 'done';   // only submitted applications appear in tracking

  if (app.status === 'Submitted' || app.status === 'Under Review' || app.status === 'Verified' || app.status === 'Incomplete') {
    states[1] = 'current';
  } else if (app.status === 'Approved') {
    states[1] = 'done';
    states[2] = 'done';
    if (d === 'Processing') states[3] = 'current';
    else if (d === 'Delayed') states[3] = 'delayed';
    else if (d === 'Released') { states[3] = 'done'; states[4] = 'done'; }
  }
  return states;
}

function renderTracking() {
  const box = $('tracking-list');
  // Drafts have not been submitted and rejected applications get no funds
  const tracked = applications.filter(function (a) { return a.status !== 'Draft' && a.status !== 'Rejected'; });
  const hiddenCount = applications.length - tracked.length;

  if (tracked.length === 0) {
    box.innerHTML = '<div class="card"><p>No submitted applications to track yet.</p>' +
      '<p class="muted">Submit an application in My Applications. It will appear here' +
      (hiddenCount > 0 ? ' (' + hiddenCount + ' draft or rejected application' + (hiddenCount === 1 ? ' is' : 's are') + ' not shown).' : '.') + '</p></div>';
    return;
  }

  let html = '';
  tracked.forEach(function (app) {
    const s = findScholarship(app.scholarshipId) || { name: 'Removed scholarship', provider: '-', compliance: [], renewal: '-' };
    const dis = app.disbursement;
    const locked = app.status !== 'Approved';
    const delayed = dis.status === 'Delayed' && !locked;
    const timeline = getTimeline(app);

    html += '<div class="card track-card' + (delayed ? ' delayed' : '') + '" data-app-id="' + app.id + '">';
    html += '<div class="app-head"><div><h4 class="sch-title">' + esc(s.name) + '</h4><div class="sch-provider">' + esc(s.provider) + '</div></div>' +
      '<div class="badges">' + statusBadge(app.status) + disbBadge(dis.status) + '</div></div>';

    if (delayed) {
      html += '<div class="delay-banner">&#9888; DELAYED: this disbursement is marked as delayed. Follow up with the scholarship office.</div>';
    }
    if (!locked && dis.date && dis.status !== 'Released' && daysUntil(dis.date) < 0) {
      html += '<div class="alert alert-warn">The scheduled disbursement date has passed but the funds are not marked as Released.</div>';
    }
    if (app.status === 'Incomplete') {
      html += '<div class="alert alert-warn">The reviewer marked this application as Incomplete. See My Applications for the note.</div>';
    }

    // Timeline
    html += '<ol class="timeline">' + TIMELINE_STEPS.map(function (label, i) {
      const st = timeline[i];
      const mark = st === 'done' ? '&#10003;' : (st === 'delayed' ? '!' : (i + 1));
      return '<li class="tl-step ' + st + '"><span class="tl-dot">' + mark + '</span><span class="tl-label">' + esc(label) + '</span></li>';
    }).join('') + '</ol>';

    // Details and editable demonstration fields
    html += '<div class="track-grid">' +
      '<div class="field"><label>Approval status</label><div>' + (app.status === 'Approved' ? '<strong>Approved</strong>' : 'Not yet approved') + '</div></div>' +
      '<div class="field"><label>Disbursement status</label><select class="t-status"' + (locked ? ' disabled' : '') + '>' +
        DISB_STATUSES.map(function (ds) { return '<option value="' + esc(ds) + '"' + (ds === dis.status ? ' selected' : '') + '>' + esc(ds) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>Expected / scheduled disbursement date</label><input type="date" class="t-date" value="' + esc(dis.date) + '"' + (locked ? ' disabled' : '') + '></div>' +
      '<div class="field"><label>Amount of assistance (PHP)</label><input type="number" class="t-amount" min="0" step="100" value="' + esc(dis.amount) + '"' + (locked ? ' disabled' : '') + '></div>' +
      '</div>';

    if (locked) {
      html += '<p class="muted">Disbursement fields unlock once the application is Approved. (For this demo, change the status in My Applications.)</p>';
    } else {
      html += '<div class="card-actions"><button class="btn btn-primary btn-small" data-action="save-tracking" data-id="' + app.id + '">Save Tracking Update</button></div>';
    }

    // Compliance and renewal requirements
    html += '<div class="two-lists"><div><h4>Compliance requirements</h4><ul>' +
      (s.compliance && s.compliance.length ? s.compliance.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') : '<li>None listed</li>') +
      '</ul></div><div><h4>Renewal requirements</h4><p>' + esc(s.renewal) + '</p></div></div>';

    html += '</div>';
  });

  if (hiddenCount > 0) {
    html += '<p class="muted">' + hiddenCount + ' draft or rejected application' + (hiddenCount === 1 ? ' is' : 's are') + ' not shown here.</p>';
  }
  box.innerHTML = html;
}

// Saves the disbursement fields of one tracking card
function saveTracking(id, card) {
  const app = findApp(id);
  if (!app || !card) return;
  if (app.status !== 'Approved') { showToast('Only approved applications can have disbursement updates.', 'error'); return; }

  const amountText = card.querySelector('.t-amount').value.trim();
  const amount = Number(amountText);
  if (amountText === '' || isNaN(amount) || amount < 0) {
    showToast('Please enter a valid amount (0 or higher).', 'error');
    return;
  }

  app.disbursement = {
    status: card.querySelector('.t-status').value,
    date: card.querySelector('.t-date').value,
    amount: amount
  };
  persistApp(app);
  renderAll();
  showToast('Tracking information updated.');
}

// Messages shown to a student whose application has been approved / rejected
const APPROVAL_MESSAGE =
  'Congratulations! You have been approved. Please proceed to the Office of Student Affairs, ' +
  'Scholarship and Financial Assistance Section for further details, or wait for the approval details ' +
  'that will be sent to your email. Thank you!';

const REJECTION_MESSAGE =
  'We regret to inform you that your application has been rejected. Please contact the Office of Student Affairs, ' +
  'Scholarship and Financial Assistance Section for further details. Thank you for your interest and we encourage you to apply again in the future.';

function approvalBox(app) {
  if (app.status === 'Approved') {
    return '<div class="approval-box">' + esc(APPROVAL_MESSAGE) + '</div>';
  }
  if (app.status === 'Rejected') {
    return '<div class="rejection-box">' + esc(REJECTION_MESSAGE) + '</div>';
  }
  return '';
}


/* =====================================================================
   8. DASHBOARD
   ===================================================================== */

function statCard(label, value, sub, colorClass) {
  return '<div class="stat ' + (colorClass || '') + '"><div class="stat-value">' + value + '</div>' +
    '<div class="stat-label">' + label + '</div><div class="stat-sub">' + sub + '</div></div>';
}

function renderDashboard() {
  const openOnes = scholarships.filter(function (s) { return !isClosed(s); });

  // Matching count (uses the saved profile). computeMatches only returns full matches.
  let matchValue = '-';
  let matchSub = 'Save your profile first';
  let matches = [];
  if (profile) {
    matches = computeMatches(profile);
    matchValue = matches.length;
    matchSub = 'full match' + (matches.length === 1 ? '' : 'es');
  }

  const underReview = applications.filter(function (a) { return a.status === 'Under Review'; }).length;
  const approved = applications.filter(function (a) { return a.status === 'Approved'; }).length;
  const pendingOrDelayed = applications.filter(function (a) {
    return a.status === 'Approved' && (a.disbursement.status === 'Pending' || a.disbursement.status === 'Delayed');
  });
  const delayedCount = pendingOrDelayed.filter(function (a) { return a.disbursement.status === 'Delayed'; }).length;

  $('stats-grid').innerHTML =
    statCard('Available scholarships', scholarships.length, openOnes.length + ' still open', '') +
    statCard('Matching your profile', matchValue, matchSub, 'gold') +
    statCard('Total applications', applications.length, applications.filter(function (a) { return a.status === 'Draft'; }).length + ' draft(s)', '') +
    statCard('Under review', underReview, 'applications', '') +
    statCard('Approved', approved, 'applications', 'green') +
    statCard('Pending or delayed disbursements', pendingOrDelayed.length, delayedCount + ' delayed', delayedCount > 0 ? 'red' : '');

  $('welcome-title').textContent = session ? 'Welcome, ' + session.name + '!' : 'Welcome, Iskx!';

  // Upcoming deadlines: next 5 open scholarships
  const upcoming = openOnes.slice().sort(function (a, b) { return (a.deadline || '').localeCompare(b.deadline || ''); }).slice(0, 5);
  $('dash-deadlines').innerHTML = upcoming.length === 0 ? '<p class="muted">No open scholarships.</p>' :
    upcoming.map(function (s) {
      return '<div class="list-item"><div><div class="title">' + esc(s.name) + '</div><div class="meta">' + formatDate(s.deadline) + '</div></div>' +
        '<div>' + deadlineBadge(s.deadline) + ' <button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View</button></div></div>';
    }).join('');

  // Recently submitted applications (drafts are not submitted yet)
  const recent = applications.filter(function (a) { return a.status !== 'Draft' && a.dateSubmitted; })
    .sort(function (a, b) { return b.dateSubmitted.localeCompare(a.dateSubmitted) || b.id - a.id; }).slice(0, 5);
  $('dash-recent').innerHTML = recent.length === 0 ? '<p class="muted">No submitted applications yet.</p>' :
    recent.map(function (a) {
      const s = findScholarship(a.scholarshipId);
      return '<div class="list-item"><div><div class="title">' + esc(s ? s.name : 'Removed scholarship') + '</div>' +
        '<div class="meta">Submitted ' + formatDate(a.dateSubmitted) + '</div></div>' + statusBadge(a.status) + '</div>';
    }).join('');

  // Recommendations: top 3 matching scholarships that are still open
  if (!profile) {
    $('dash-recs').innerHTML = '<p class="muted">Save your student profile to see personalized recommendations.</p>' +
      '<button class="btn btn-gold btn-small" data-action="goto" data-page="matching">Create my profile</button>';
  } else {
    const recs = matches.filter(function (m) { return !isClosed(m.scholarship); }).slice(0, 3);
    $('dash-recs').innerHTML = recs.length === 0 ? '<p class="muted">No open scholarships match your profile right now.</p>' :
      recs.map(function (m) {
        return '<div class="list-item"><div><div class="title">' + esc(m.scholarship.name) + '</div>' +
          '<div class="meta">' + esc(m.scholarship.provider) + ' &middot; deadline ' + formatDate(m.scholarship.deadline) + '</div></div>' +
          '<div>' + (m.result.level === 'full' ? '<span class="badge badge-green">Full match</span>' : '<span class="badge badge-amber">Partial match</span>') +
          ' <button class="btn btn-secondary btn-small" data-action="view" data-id="' + m.scholarship.id + '">Details</button></div></div>';
      }).join('');
  }
}


function renderAll() {
  renderRoleInfo();
  if (isAdmin()) {
    renderMarketplace();
    renderManage();
    renderStudentApps();
  } else {
    renderDashboard();
    renderMarketplace();
    renderApplications();
    renderTracking();
  }
}


/* =====================================================================
   8A. TEXT EXTRACTION FROM ANNOUNCEMENT PDFs
   ===================================================================== */

async function pdfToText(file) {
  if (!window.pdfjsLib) throw new Error('The PDF reader (PDF.js) did not load. Check your internet connection and reload the page.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent();
    let line = '';
    let lastY = null;
    content.items.forEach(function (it) {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) { out += line + '\n'; line = ''; }
      lastY = y;
      line += it.str + ' ';
      if (it.hasEOL) { out += line + '\n'; line = ''; }
    });
    out += line + '\n';
  }
  return out;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const MONEY_RE = /(?:PHP|Php|php|₱|P(?=\s?\d))\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/;
const LABELS = 'scholarship name|name of (?:the )?(?:scholarship|program|grant)|program name|provider|sponsor(?:ing)?(?: organization| agency)?|offered by|granted by|funded by|description|about(?: the scholarship)?|overview|background|eligibility(?: requirements)?|qualifications|who (?:may|can) apply|benefits|financial assistance|privileges|stipend|required documents|documentary requirements|documents? required|list of requirements|application requirements|requirements|documents|attachments|deadline|how to apply|application (?:procedure|process|instructions)|procedure|instructions|contact(?: us| details)?|renewal|notes?|link|website';

function makeISO(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return y + '-' + pad(m) + '-' + pad(d);
}

function parseDateText(t) {
  let m;
  if ((m = t.match(/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/))) return makeISO(+m[1], +m[2], +m[3]);
  if ((m = t.match(new RegExp('\\b' + MONTH_RE + '\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)\\b', 'i')))) return makeISO(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
  if ((m = t.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MONTH_RE + ',?\\s+(20\\d\\d)\\b', 'i')))) return makeISO(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d\d)\b/))) return makeISO(+m[3], +m[1], +m[2]);
  return '';
}

function cleanBullet(line) {
  return line.replace(/^\s*(?:[•·▪●○◦■□\-–—*]|\(?\d{1,2}[.)]|\(?[a-zA-Z][.)])\s+/, '').trim();
}

// Looks for a heading like "Eligibility:" and returns the text under it (an array of lines)
function findSection(lines, labelList) {
  const headStop = new RegExp('^\\s*(?:[IVX\\d]+[.)]\\s*)?(?:' + LABELS + ')\\b\\s*(?::|-|–)', 'i');
  const bareHead = /^\s*(?:[IVX\d]+[.)]\s*)?(?:[A-Z][A-Za-z&\/ ,'-]{2,50}:|[A-Z][A-Z &\/'-]{3,50}:?)\s*$/;
  for (let k = 0; k < labelList.length; k++) {
    const re = new RegExp('^\\s*(?:[IVX\\d]+[.)]\\s*)?(?:' + labelList[k] + ')\\b\\s*(:|-|–)?\\s*(.*)$', 'i');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(re);
      if (!m || (!m[1] && m[2] !== '')) continue;
      const out = m[2] ? [m[2]] : [];
      for (let j = i + 1; j < lines.length && out.length < 25; j++) {
        if (headStop.test(lines[j]) || bareHead.test(lines[j])) break;
        out.push(lines[j]);
      }
      if (out.length) return out;
    }
  }
  return null;
}

function labelValue(lines, labelRe) {
  const re = new RegExp('^\\s*(?:' + labelRe + ')\\s*(?::|-|–)\\s*(.+)$', 'i');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function parseScholarshipText(text) {
  const lines = text.split(/\n/).map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  const flat = lines.join('\n');
  const notes = [];
  const d = {
    name: '', provider: '', type: '', description: '', courses: [], yearLevels: [], fields: [],
    maxGWA: null, maxIncome: null, allowsExistingAid: true, benefits: '', benefitAmount: '',
    documents: [], deadline: '', instructions: '', link: '', compliance: [], renewal: ''
  };

  // Name
  d.name = labelValue(lines, 'scholarship name|name of (?:the )?(?:scholarship|program|grant)|program name|title');
  if (!d.name) {
    const guess = lines.slice(0, 12).find(function (l) {
      return /(scholarship|grant|fellowship|financial assistance|assistance program)/i.test(l) && l.length >= 10 && l.length <= 120 && !/^(dear|this|please|we |the .* is)/i.test(l);
    });
    if (guess) { d.name = guess.replace(/^(subject|re)\s*:\s*/i, ''); notes.push('The scholarship name was guessed from the heading of the PDF.'); }
  }

  // Provider
  d.provider = labelValue(lines, 'provider|scholarship provider|sponsor(?:ing)?(?: organization| agency)?|offered by|granted by|funded by|sponsored by|donor|grantor|source of funds');
  if (!d.provider) {
    const m = flat.match(/(?:offered|sponsored|granted|funded|administered|awarded) by (?:the )?([A-Za-z][^.\n,;]{3,80})/i);
    if (m) d.provider = m[1].trim();
  }

  // Type (only when the provider or text clearly says so)
  const ptext = d.provider + ' ' + flat;
  if (/alumni/i.test(d.provider)) d.type = 'Alumni';
  else if (/\b(CHED|DOST|DOLE|DSWD|DepEd|Commission on Higher Education|Department of|government|national|provincial|municipal|city of)\b/i.test(d.provider)) d.type = 'Government';
  else if (/foundation|corporation|\binc\b|company|bank|group|holdings|private/i.test(d.provider)) d.type = 'Private';
  else if (/University of the Philippines|\bUP\b|university|college/i.test(d.provider)) d.type = 'University';
  else if (/\b(CHED|DOST|Commission on Higher Education)\b/i.test(ptext)) d.type = 'Government';

  // Benefits and amount
  const benSec = findSection(lines, ['benefits', 'financial assistance', 'financial benefits', 'privileges', 'stipend', 'grant']);
  let benText = benSec ? benSec.map(cleanBullet).join('; ') : '';
  if (!benText) {
    const l = lines.find(function (x) { return MONEY_RE.test(x) && /(grant|stipend|allowance|tuition|assistance|per semester|monthly|scholar)/i.test(x); });
    if (l) benText = l;
  }
  d.benefits = benText.slice(0, 300);
  const mm = d.benefits.match(MONEY_RE);
  if (mm) { d.benefitAmount = Number(mm[1].replace(/,/g, '')); notes.push('The amount per release was taken from the first peso figure in the benefits text.'); }

  // Description
  const descSec = findSection(lines, ['description', 'about(?: the scholarship)?', 'overview', 'background', 'introduction']);
  if (descSec) d.description = descSec.join(' ').slice(0, 500);
  else {
    const para = lines.find(function (l, i) { return i > 0 && l.length >= 80 && !new RegExp('^(?:' + LABELS + ')\\b\\s*[:\\-–]', 'i').test(l); });
    if (para) { d.description = para.slice(0, 500); notes.push('The description was taken from the first long paragraph of the PDF.'); }
  }

  const eligSec = findSection(lines, ['eligibility(?: requirements)?', 'qualifications', 'who (?:may|can) apply', 'qualified applicants', 'applicants must']);
  const elig = eligSec ? eligSec.join(' ') : flat.replace(/\n/g, ' ');

  // Courses
  if (/\b(any|all) (?:degree )?(?:programs?|courses?|degrees?|disciplines)\b|open to all (?:students|programs|courses)/i.test(elig)) d.courses = ['Any'];
  else d.courses = COURSES.filter(function (c) {
    const short = c.replace(/^(BS|BA|AA|B) /, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + short + '\\b', 'i').test(elig);
  });

  // Year levels
  let y = elig.toLowerCase().replace(/\bfirst\b|\bfreshm[ae]n\b/g, '1st').replace(/\bsecond\b|\bsophomores?\b/g, '2nd')
    .replace(/\bthird\b|\bjuniors?\b/g, '3rd').replace(/\bfourth\b|\bseniors?\b/g, '4th').replace(/\bfifth\b/g, '5th');
  if (/all year levels|any year level|all levels/.test(y)) d.yearLevels = YEARS.slice();
  else {
    const set = {};
    let r;
    const range = /([1-5])(?:st|nd|rd|th)?\s*(?:year)?\s*(?:to|-|–|up to|until|through)\s*([1-5])(?:st|nd|rd|th)?\s*year/g;
    while ((r = range.exec(y))) { for (let n = +r[1]; n <= +r[2]; n++) set[n] = true; }
    const single = /([1-5])(?:st|nd|rd|th)\s*year|\b([1-5])(?:st|nd|rd|th)\b/g;
    while ((r = single.exec(y))) set[r[1] || r[2]] = true;
    d.yearLevels = Object.keys(set).map(Number).sort();
  }

  // Field of study (College). Names must match INTERESTS exactly.
  if (eligSec) {
    const fieldRules = [
      ['College of Science & Mathematics', /applied mathematics|biology|food technology|data science|computer science/i],
      ['School of Management', /agribusiness economics/i],
      ['College of Humanities and Social Sciences', /architecture|anthropology|english|communication/i],
      ['Department of Human Kinetics', /sport science/i]
    ];
    if (/any field|all fields|regardless of (?:field|course)/i.test(elig)) d.fields = ['Any'];
    else d.fields = fieldRules.filter(function (r2) { return r2[1].test(elig); }).map(function (r2) { return r2[0]; });
  }

  // GWA (UP scale: lower is better)
  const g = flat.match(/(?:GWA|G\.W\.A\.?|general weighted average|weighted average|GPA)[^.\n]{0,80}?\b([1-5]\.\d{1,2})\b/i);
  if (g) d.maxGWA = Number(g[1]);

  // Family income. Limits in announcements are ANNUAL, and the app stores annual limits too.
  const inc = flat.match(/(?:family|household|parents?'?s?|gross)?[ \w]{0,20}income[^.\n]{0,100}?(?:PHP|Php|php|₱|P)\s?(\d{1,3}(?:,\d{3})+|\d+)/i);
  if (inc) {
    d.maxIncome = Number(inc[1].replace(/,/g, ''));
    if (/month/i.test(inc[0]) && !/annual|yearly|per year|per annum/i.test(inc[0])) {
      d.maxIncome = d.maxIncome * 12;
      notes.push('The income limit in the PDF is monthly, so it was multiplied by 12 to get the annual figure used by this app.');
    }
  }

  // Other scholarships / assistance
  if (/no other scholarship|not (?:be )?(?:a )?(?:grantee|recipient|availing|receiving|enjoying)[^.\n]{0,60}(?:scholarship|financial assistance)|should not (?:be )?(?:enjoying|receiving)/i.test(flat)) d.allowsExistingAid = false;

  // Required documents
  const docSec = findSection(lines, ['required documents', 'documentary requirements', 'documents? required', 'list of requirements', 'application requirements', 'submit the following', 'documents? to (?:be )?submit(?:ted)?', 'attachments', 'documents']);
  if (docSec) {
    const seen = {};
    d.documents = docSec.map(cleanBullet).filter(function (t) {
      if (t.length < 3 || t.length > 150 || seen[t.toLowerCase()]) return false;
      seen[t.toLowerCase()] = true;
      return true;
    });
  }

  // Deadline
  for (let i = 0; i < lines.length && !d.deadline; i++) {
    if (/deadline|on or before|not later than|until|submit(?:ted)? (?:on|by)|closing date|due date|last day/i.test(lines[i])) {
      d.deadline = parseDateText(lines[i] + ' ' + (lines[i + 1] || ''));
    }
  }

  // Instructions
  const insSec = findSection(lines, ['how to apply', 'application procedure', 'application process', 'application instructions', 'procedure', 'instructions', 'mechanics']);
  if (insSec) d.instructions = insSec.map(cleanBullet).join(' ').slice(0, 500);

  // External link
  const url = flat.match(/\bhttps?:\/\/[^\s<>"')]+/i) || flat.match(/\bwww\.[^\s<>"')]+/i);
  if (url) { d.link = url[0].replace(/[.,;]+$/, ''); if (!/^https?:/i.test(d.link)) d.link = 'https://' + d.link; }

  const checks = [
    ['Scholarship name', d.name], ['Provider', d.provider], ['Description', d.description], ['Type', d.type],
    ['Benefits', d.benefits], ['Eligible programs', d.courses.length], ['Year levels', d.yearLevels.length],
    ['Field of study', d.fields.length], ['Required GWA', d.maxGWA !== null], ['Maximum family income', d.maxIncome !== null],
    ['Required documents', d.documents.length], ['Deadline', d.deadline], ['Instructions', d.instructions], ['External link', d.link]
  ];
  const found = checks.filter(function (c) { return c[1]; }).map(function (c) { return c[0]; });
  const missing = checks.filter(function (c) { return !c[1]; }).map(function (c) { return c[0]; });
  return { data: d, found: found, missing: missing, notes: notes };
}


/* =====================================================================
   8B. SIGN-IN, ROLES AND ADMIN SCHOLARSHIP MANAGEMENT
   Cloud mode uses Supabase Auth: email + password (no email verification / OTP step)
   or "Continue with Google" (OAuth).
   Admin rights are granted ONLY by the server (the claim_admin function in setup.sql), never by this file.
   Local demo mode (no config.js keys) has no real security.
   ===================================================================== */

const ROLE_PAGES = {
  student: ['dashboard', 'matching', 'marketplace', 'applications', 'tracking'],
  admin: ['manage', 'studentapps', 'marketplace']
};

let selectedRole = 'student';   // the account type chosen on the sign-in screen
let registeringEmail = '';      // set while a first-time user fills in their profile

function isAdmin() { return !!session && session.role === 'admin'; }
function defaultPage() { return isAdmin() ? 'manage' : 'dashboard'; }
function pageAllowed(name) { return !!session && ROLE_PAGES[session.role].includes(name); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

// ----- Sign-in screen -----
function setBoxError(id, message) {
  const box = $(id);
  if (!message) { box.classList.add('hidden'); box.textContent = ''; return; }
  box.textContent = message;
  box.classList.remove('hidden');
}
function showLoginError(message) { setBoxError('login-error', message); }

// Account type is chosen on the profile step (right after creating the account)
function pickRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-card').forEach(function (b) {
    b.classList.toggle('selected', b.dataset.role === role);
  });
  $('reg-student-fields').classList.toggle('hidden', role !== 'student');
  $('reg-admin-fields').classList.toggle('hidden', role !== 'admin');
  $('reg-title').textContent = 'Welcome! Create your ' + (role === 'admin' ? 'admin staff' : 'student') + ' profile';
}

function showLoginStep(step) {   // 'signin', 'signup' or 'register'
  ['signin', 'signup', 'register'].forEach(function (n) {
    $('login-' + n).classList.toggle('hidden', step !== n);
  });
}

// ----- Sign in (email + password) -----
async function handleSignIn() {
  const email = val('login-email').trim().toLowerCase();
  const pass = val('login-pass');
  if (!isValidEmail(email)) { showLoginError('Please enter a valid email address.'); return; }
  if (!pass) { showLoginError('Please enter your password.'); return; }

  showLoginError('');
  $('login-btn').disabled = true;
  try {
    if (sb) {
      const res = await sb.auth.signInWithPassword({ email: email, password: pass });
      if (res.error) {
        showLoginError(/not confirmed/i.test(res.error.message)
          ? 'This account was created while email confirmation was still turned on in Supabase. Turn off "Confirm email" (Authentication > Providers > Email) and create the account again.'
          : 'Incorrect email or password.');
        return;
      }
    }
    await finishAuthenticated(email);
  } catch (e) {
    showLoginError('Cannot reach the shared database: ' + (e.message || e));
  } finally {
    $('login-btn').disabled = false;
  }
}

// ----- Sign in with Google (redirects to Google, then back to this page) -----
// The page address Google sends the person back to. It must also be listed in Supabase under
// Authentication > URL Configuration > Redirect URLs (see the notes in config.js).
function oauthRedirectUrl() {
  return window.location.origin + window.location.pathname.replace(/index\.html$/, '');
}

async function signInWithGoogle() {
  // Report the problem in whichever form is on screen (sign-in or sign-up)
  const signupVisible = !$('login-signup').classList.contains('hidden');
  const report = function (msg) { if (signupVisible) setBoxError('signup-error', msg); else showLoginError(msg); };
  report('');

  if (!sb) {
    report(CFG.LOCAL_DEMO_MODE
      ? 'Google sign-in is not available in local demo mode. Set LOCAL_DEMO_MODE to false in config.js.'
      : 'Google sign-in could not start because the Supabase library did not load. Check your internet connection and reload the page.');
    return;
  }
  if (window.location.protocol === 'file:') {
    report('Google sign-in needs the app to be served over http(s). Open it from your GitHub Pages link or a local server instead of a file.');
    return;
  }

  try {
    const res = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectUrl(),
        queryParams: { prompt: 'select_account' }   // always let the person pick which Google account to use
      }
    });
    if (res.error) report('Google sign-in failed: ' + res.error.message);
    // On success the browser is already on its way to Google, so there is nothing more to do here.
  } catch (e) {
    report('Google sign-in failed: ' + (e.message || e));
  }
}

// If Google or Supabase sent the person back with an error (for example "redirect_uri_mismatch"
// or "access_denied"), show it on the sign-in screen and tidy the address bar.
function showOAuthReturnError() {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const desc = params.get('error_description') || hash.get('error_description');
  const code = params.get('error') || hash.get('error');
  if (!desc && !code) return;
  showLoginError('Google sign-in did not finish: ' + (desc || code).replace(/\+/g, ' '));
  history.replaceState(null, '', window.location.pathname);
}

// Called once the person is really signed in: load their profile or ask for one
async function finishAuthenticated(email) {
  const user = await store.get('users', email);
  if (user) await completeSignIn(user);
  else openRegistration(email);
}

// ----- Create account: no email verification; go straight to the profile step -----
async function handleSignUp() {
  const email = val('signup-email').trim().toLowerCase();
  const pass = val('signup-pass');
  if (!isValidEmail(email)) { setBoxError('signup-error', 'Please enter a valid email address.'); return; }
  if (pass.length < 8) { setBoxError('signup-error', 'Your password must be at least 8 characters.'); return; }
  if (pass !== val('signup-pass2')) { setBoxError('signup-error', 'The two passwords do not match.'); return; }
  setBoxError('signup-error', '');

  if (!sb) { openRegistration(email); return; }           // local demo mode: no account server

  $('signup-btn').disabled = true;
  try {
    const res = await sb.auth.signUp({ email: email, password: pass });
    if (res.error) { setBoxError('signup-error', res.error.message); return; }
    if (!res.data.session) {
      // Supabase still has "Confirm email" turned on, so no session was issued. Try signing in directly.
      const login = await sb.auth.signInWithPassword({ email: email, password: pass });
      if (login.error) {
        setBoxError('signup-error', 'Supabase still requires email confirmation. Turn off "Confirm email" (Authentication > Providers > Email) and try again.');
        return;
      }
    }
    await finishAuthenticated(email);
  } catch (e) {
    setBoxError('signup-error', 'Could not create the account: ' + (e.message || e));
  } finally {
    $('signup-btn').disabled = false;
  }
}

// ----- Profile step (first sign-in only) -----
function openRegistration(email) {
  registeringEmail = email;
  $('reg-email').value = email;
  $('reg-name').value = '';
  $('reg-number').value = '';
  $('reg-course').value = '';
  $('reg-year').value = '';
  $('reg-position').value = '';
  $('reg-admincode').value = '';
  pickRole('student');
  $('reg-error').classList.add('hidden');
  showLoginStep('register');
}

async function cancelRegistration() {
  if (sb) await sb.auth.signOut();
  showLoginStep('signin');
}

async function handleRegister() {
  const errors = [];
  const name = val('reg-name').trim();
  const adminCode = val('reg-admincode').trim();
  if (!name) errors.push('Full name is required.');
  if (selectedRole === 'student') {
    if (!val('reg-course')) errors.push('Please select your course or degree program.');
    if (!val('reg-year')) errors.push('Please select your year level.');
  }
  if (selectedRole === 'admin' && sb && !adminCode) errors.push('The admin registration code is required.');
  if (errors.length) { $('reg-error').textContent = errors.join(' '); $('reg-error').classList.remove('hidden'); return; }

  // Admin rights are decided by the SERVER: it checks the code and records this email as an admin.
  if (selectedRole === 'admin' && sb) {
    const r = await sb.rpc('claim_admin', { code: adminCode });
    const msg = r.error ? 'Could not check the admin code: ' + r.error.message
      : r.data === 'locked' ? 'Too many incorrect attempts. Please try again later.'
      : r.data !== 'ok' ? 'Incorrect admin registration code.' : '';
    if (msg) { $('reg-error').textContent = msg; $('reg-error').classList.remove('hidden'); return; }
  }

  const user = {
    id: registeringEmail, email: registeringEmail, fullName: name, role: selectedRole,
    registeredAt: new Date().toISOString(),
    studentNumber: selectedRole === 'student' ? val('reg-number').trim() : '',
    course: selectedRole === 'student' ? val('reg-course') : '',
    yearLevel: selectedRole === 'student' ? Number(val('reg-year')) : null,
    position: selectedRole === 'admin' ? val('reg-position').trim() : ''
  };
  try {
    await store.put('users', user, true);      // fails if this email already has a profile
  } catch (e) {
    if (e.message === 'DUPLICATE') {
      showLoginStep('signin');
      showLoginError('This email address already has an account. Please sign in.');
    } else {
      $('reg-error').textContent = 'Could not save your account: ' + (e.message || e);
      $('reg-error').classList.remove('hidden');
    }
    return;
  }
  await completeSignIn(user, 'Account created. Welcome, ' + name + '!');
}

async function completeSignIn(user, message) {
  // The role always comes from the server (the admins table), never from the stored profile
  if (sb) {
    const r = await sb.rpc('is_admin');
    user.role = (!r.error && r.data === true) ? 'admin' : 'student';
  }
  currentUser = user;
  session = { role: user.role, name: user.fullName, email: user.email };
  if (!sb) saveJSON(KEYS.session, { email: user.email });   // local demo mode only
  profile = user.profile || null;
  matchingShown = false;
  $('matching-results').innerHTML = '';
  await refreshData();
  fillProfileForm();
  ['login-email', 'login-pass', 'signup-email', 'signup-pass', 'signup-pass2'].forEach(function (id) { $(id).value = ''; });
  showLoginError('');
  showLoginStep('signin');
  showSessionScreen();
  showToast(message || ('Welcome back, ' + user.fullName + '!'));
}

async function signOut() {
  if (sb) { try { await sb.auth.signOut(); } catch (e) { console.warn(e); } }
  session = null;
  currentUser = null;
  profile = null;
  scholarships = [];
  applications = [];
  saveJSON(KEYS.session, null);
  closeModal();
  closePreview();
  closeMenu();
  editingAppId = null;
  editingScholarshipId = null;
  pickRole('student');
  showLoginStep('signin');
  showSessionScreen();
  showToast('You have signed out.', 'info');
}

function showSessionScreen() {
  if (!session) { document.body.classList.add('logged-out'); return; }
  document.body.classList.remove('logged-out');
  applyRole();
  showPage(defaultPage());
}

// Shows only the navigation buttons and controls that the signed-in role may use
function applyRole() {
  document.querySelectorAll('[data-roles]').forEach(function (b) {
    b.classList.toggle('hidden', !b.dataset.roles.split(' ').includes(session.role));
  });
}

function renderRoleInfo() {
  if (!session) return;
  $('role-info').innerHTML = '<span class="badge">' + (isAdmin() ? 'Admin Staff' : 'Student') + '</span>' +
    '<div class="role-name">' + esc(session.name) + '</div><div class="role-email">' + esc(session.email) + '</div>';
  $('student-chip').textContent = (isAdmin() ? 'Admin: ' : '') + session.name;
}

// ----- Admin: scholarship form helpers -----
function linesOf(text) {
  return text.split(/\r?\n/).map(function (t) { return t.trim(); }).filter(function (t) { return t !== ''; });
}

function checkGroupHTML(name, items) {
  return items.map(function (it) {
    return '<label class="check"><input type="checkbox" name="' + name + '" value="' + esc(it.value) + '"> ' + esc(it.label) + '</label>';
  }).join('');
}

function checkedValues(name) {
  return Array.from(document.querySelectorAll('input[name="' + name + '"]:checked')).map(function (b) { return b.value; });
}

function setChecked(name, values) {
  const wanted = values.map(String);
  document.querySelectorAll('input[name="' + name + '"]').forEach(function (b) { b.checked = wanted.includes(b.value); });
}

function buildScholarshipFormChoices() {
  fillSelect('sch-type', TYPES, 'Select a type');
  $('sch-courses').innerHTML = checkGroupHTML('sch-course',
    [{ value: 'Any', label: 'Any program' }].concat(COURSES.map(function (c) { return { value: c, label: c }; })));
  $('sch-years').innerHTML = checkGroupHTML('sch-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }));
  $('sch-fields').innerHTML = checkGroupHTML('sch-field',
    [{ value: 'Any', label: 'Any field' }].concat(INTERESTS.map(function (i) { return { value: i, label: i }; })));
}

function showScholarshipForm(show) {
  $('sch-list-view').classList.toggle('hidden', show);
  $('sch-form-view').classList.toggle('hidden', !show);
}

function showSchErrors(errors) {
  const box = $('sch-errors');
  if (errors.length === 0) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.innerHTML = '<strong>Please fix the following:</strong><ul>' +
    errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>';
  box.classList.remove('hidden');
}

// Shows the original announcement PDF (a newly picked file, or the one saved with the listing)
function renderSchPdfBox() {
  const box = $('sch-pdf-box');
  const s = editingScholarshipId ? findScholarship(editingScholarshipId) : null;
  if (pendingAnnouncement) {
    box.innerHTML = '<strong>Original announcement:</strong> ' + esc(pendingAnnouncement.name) + ' (' + fmtSize(pendingAnnouncement.size) + ') ' +
      '<button type="button" class="btn btn-secondary btn-small" data-action="pending-pdf-view">View</button>' +
      '<button type="button" class="btn btn-secondary btn-small" data-action="pending-pdf-download">Download</button>';
  } else if (s && s.announcement) {
    box.innerHTML = '<strong>Original announcement:</strong> ' + esc(s.announcement.name) + ' (' + fmtSize(s.announcement.size) + ') ' + fileButtons(s.announcement);
  } else {
    box.innerHTML = '<span class="muted">No announcement PDF is attached to this listing.</span>';
  }
}

// Opens the form empty (add), with an existing listing (edit), or with extracted data (prefill)
function openScholarshipForm(id, prefill, pendingFile, reviewHTML) {
  if (!isAdmin()) return;
  const s = id ? findScholarship(id) : null;
  editingScholarshipId = s ? s.id : null;
  pendingAnnouncement = pendingFile || null;
  $('sch-form-title').textContent = s ? 'Edit Scholarship' : 'Add Scholarship';

  const d = prefill || s || {
    name: '', provider: '', type: '', description: '', courses: [], yearLevels: [], fields: [],
    maxGWA: null, maxIncome: null, allowsExistingAid: true, benefits: '', benefitAmount: '',
    documents: [], deadline: '', instructions: '', link: '', compliance: [], renewal: ''
  };
  $('sch-name').value = d.name;
  $('sch-provider').value = d.provider;
  $('sch-type').value = TYPES.includes(d.type) ? d.type : '';
  $('sch-deadline').value = d.deadline;
  $('sch-desc').value = d.description;
  setChecked('sch-course', d.courses);
  setChecked('sch-year', d.yearLevels);
  setChecked('sch-field', d.fields);
  $('sch-gwa').value = d.maxGWA === null ? '' : d.maxGWA;
  $('sch-income').value = d.maxIncome === null ? '' : d.maxIncome;
  $('sch-aid').checked = d.allowsExistingAid;
  $('sch-benefits').value = d.benefits;
  $('sch-amount').value = d.benefitAmount;
  $('sch-docs').value = d.documents.join('\n');
  $('sch-instructions').value = d.instructions;
  $('sch-link').value = d.link || '';
  $('sch-compliance').value = d.compliance.join('\n');
  $('sch-renewal').value = d.renewal;
  showLogoPreview(d.logo || '');

  const note = $('sch-review-note');
  note.innerHTML = reviewHTML || '';
  note.classList.toggle('hidden', !reviewHTML);
  $('sch-publish-btn').textContent = s && s.published !== false ? 'Save Changes' : 'Publish Scholarship';
  $('sch-draft-btn').classList.toggle('hidden', !!(s && s.published !== false));
  renderSchPdfBox();
  showSchErrors([]);
  showScholarshipForm(true);
  window.scrollTo(0, 0);
}

function readScholarshipForm() {
  let courses = checkedValues('sch-course');
  if (courses.includes('Any')) courses = ['Any'];
  let fields = checkedValues('sch-field');
  if (fields.includes('Any')) fields = ['Any'];
  return {
    name: val('sch-name').trim(),
    provider: val('sch-provider').trim(),
    type: val('sch-type'),
    deadline: val('sch-deadline'),
    description: val('sch-desc').trim(),
    courses: courses,
    yearLevels: checkedValues('sch-year').map(Number).sort(function (a, b) { return a - b; }),
    fields: fields,
    gwaText: val('sch-gwa').trim(),
    incomeText: val('sch-income').trim(),
    allowsExistingAid: $('sch-aid').checked,
    benefits: val('sch-benefits').trim(),
    amountText: val('sch-amount').trim(),
    documents: linesOf(val('sch-docs')),
    instructions: val('sch-instructions').trim(),
    link: val('sch-link').trim(),
    compliance: linesOf(val('sch-compliance')),
    renewal: val('sch-renewal').trim()
  };
}

// Publishing needs every required field. An unpublished draft only needs a name and provider.
function validateScholarship(f, publish) {
  const errors = [];
  if (!f.name) errors.push('Scholarship name is required.');
  if (!f.provider) errors.push('Provider is required.');

  if (publish) {
    if (!f.type) errors.push('Please select a scholarship type.');
    if (f.courses.length === 0) errors.push('Select at least one eligible program (or "Any program").');
    if (f.yearLevels.length === 0) errors.push('Select at least one eligible year level.');
    if (f.fields.length === 0) errors.push('Select at least one field of study (or "Any field").');
    if (!f.benefits) errors.push('Benefits text is required.');
    const amount = Number(f.amountText);
    if (f.amountText === '' || isNaN(amount) || amount < 0) errors.push('Amount per release must be a number (0 or higher).');
    if (f.documents.length === 0) errors.push('List at least one required document (one per line).');
    if (!f.instructions) errors.push('Application instructions are required.');
    if (!f.deadline) errors.push('Deadline is required.');
    else if (editingScholarshipId === null && daysUntil(f.deadline) < 0) errors.push('The deadline of a new scholarship cannot be in the past.');
  }
  if (f.gwaText !== '') {
    const g = Number(f.gwaText);
    if (isNaN(g) || g < 1 || g > 5) errors.push('Required GWA must be between 1.00 and 5.00 (or leave it blank).');
  }
  if (f.incomeText !== '') {
    const inc = Number(f.incomeText);
    if (isNaN(inc) || inc < 0) errors.push('Maximum annual family income must be 0 or higher (or leave it blank).');
  }
  if (f.link && !/^https?:\/\/\S+$/i.test(f.link)) errors.push('The external link must start with http:// or https://');

  const duplicate = scholarships.some(function (s) {
    return s.id !== editingScholarshipId && s.name.toLowerCase() === f.name.toLowerCase() && s.provider.toLowerCase() === f.provider.toLowerCase();
  });
  if (f.name && f.provider && duplicate) errors.push('A scholarship with this name and provider already exists.');
  return errors;
}

// publish = true: the scholarship becomes visible to every student. false: saved as an unpublished draft.
async function saveScholarship(publish) {
  if (!isAdmin() || saving) return;
  const f = readScholarshipForm();
  const errors = validateScholarship(f, publish);
  if (errors.length > 0) {
    showSchErrors(errors);
    showToast('Scholarship not saved. Please fix the errors.', 'error');
    return;
  }

  const existing = editingScholarshipId ? findScholarship(editingScholarshipId) : null;
  const wasPublished = !!existing && existing.published !== false;
  if (publish && !wasPublished && !confirm('Publish this scholarship? It will immediately appear in the Scholarship Marketplace and Matching page for ALL students.\n\nHave you verified the details against the original PDF?')) return;

  saving = true;
  const data = {
    name: f.name, provider: f.provider, type: f.type, description: f.description,
    courses: f.courses, yearLevels: f.yearLevels,
    maxGWA: f.gwaText === '' ? null : Number(f.gwaText),
    maxIncome: f.incomeText === '' ? null : Number(f.incomeText),
    fields: f.fields, allowsExistingAid: f.allowsExistingAid, benefits: f.benefits,
    benefitAmount: f.amountText === '' ? 0 : Number(f.amountText),
    documents: f.documents, deadline: f.deadline, instructions: f.instructions, link: f.link,
    compliance: f.compliance, renewal: f.renewal || 'Not specified.',
    published: publish || wasPublished,
    logo: schLogoData
  };

  const s = existing || Object.assign({ id: Date.now(), isSample: false, createdBy: currentUser.email }, data);
  if (existing) Object.assign(s, data);
  if (publish && !wasPublished) s.publishedAt = new Date().toISOString();

  // Upload the original announcement PDF (if a new one was attached)
  if (pendingAnnouncement) {
    const path = 'announcements/' + s.id + '-' + Date.now() + '-' + safeName(pendingAnnouncement.name);
    try { await store.upload(path, pendingAnnouncement); }
    catch (e) { saving = false; showToast('Could not upload the announcement PDF: ' + (e.message || e), 'error'); return; }
    if (s.announcement) store.removeFiles([s.announcement.path]);
    s.announcement = { name: pendingAnnouncement.name, type: 'application/pdf', size: pendingAnnouncement.size, path: path };
  }

  const ok = await persistScholarship(s);
  saving = false;
  if (!ok) return;
  if (!existing) scholarships.push(s);

  pendingAnnouncement = null;
  editingScholarshipId = null;
  clearAnnouncementPicker();
  renderAll();
  showScholarshipForm(false);
  showToast(s.published ? 'Scholarship published. Students can now see it in the Marketplace.' : 'Scholarship saved as an unpublished draft.');
}

async function toggleScholarship(id) {
  const s = findScholarship(id);
  if (!s || !isAdmin()) return;
  const publishing = s.published === false;
  if (publishing && (!s.deadline || !s.documents.length || !s.type)) { showToast('Complete the listing (Edit) before publishing it.', 'error'); return; }
  s.published = publishing;
  if (!(await persistScholarship(s))) { s.published = !publishing; return; }
  renderAll();
  showToast(publishing ? 'Scholarship published.' : 'Scholarship unpublished. Students can no longer see it.');
}

async function deleteScholarship(id) {
  if (!isAdmin()) return;
  const s = findScholarship(id);
  if (!s) return;
  const count = applications.filter(function (a) { return a.scholarshipId === id; }).length;
  if (count > 0) { showToast('Cannot delete: ' + count + ' application' + (count === 1 ? '' : 's') + ' exist for this scholarship.', 'error'); return; }
  if (!confirm('Delete the scholarship "' + s.name + '"? This cannot be undone.')) return;
  if (!(await safe(store.del('scholarships', id), 'Could not delete the scholarship'))) return;
  if (s.announcement) store.removeFiles([s.announcement.path]);
  scholarships = scholarships.filter(function (x) { return x.id !== id; });
  renderAll();
  showToast('Scholarship deleted.');
}

// ----- Admin: upload announcement PDF and extract -----
function clearAnnouncementPicker() {
  announcementFile = null;
  $('ann-file').value = '';
  $('ann-filename').textContent = 'No file chosen';
  $('ann-extract-btn').disabled = true;
  $('ann-status').classList.add('hidden');
}

function showAnnStatus(message, type) {
  const box = $('ann-status');
  box.className = 'alert alert-' + (type || 'info');
  box.textContent = message;
}

function handleAnnouncementPicked(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (extOf(file.name) !== 'pdf' || (file.type && file.type !== 'application/pdf')) {
    clearAnnouncementPicker();
    showAnnStatus('Please choose a PDF file (.pdf).', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) { clearAnnouncementPicker(); showAnnStatus('The PDF is larger than 10 MB.', 'error'); return; }
  announcementFile = file;
  $('ann-filename').textContent = file.name + ' (' + fmtSize(file.size) + ')';
  $('ann-extract-btn').disabled = false;
  $('ann-status').classList.add('hidden');
}

async function extractAnnouncement() {
  if (!announcementFile) return;
  const file = announcementFile;
  $('ann-extract-btn').disabled = true;
  showAnnStatus('Reading the PDF... please wait.', 'info');
  let text = '';
  try { text = await pdfToText(file); }
  catch (e) {
    console.error(e);
    showAnnStatus('Could not read this PDF automatically (' + (e.message || e) + '). You can enter the details manually.', 'error');
    $('ann-extract-btn').disabled = false;
    openScholarshipForm(null, null, file, '<strong>Manual entry needed.</strong> The PDF could not be read. Please type the scholarship details yourself. The PDF will be attached to the listing.');
    return;
  }
  $('ann-extract-btn').disabled = false;

  if (text.replace(/\s/g, '').length < 60) {
    showAnnStatus('This PDF seems to be scanned or made of images, so no selectable text was found.', 'warn');
    openScholarshipForm(null, null, file,
      '<strong>No text found.</strong> This PDF looks scanned or image-based, so automatic extraction may not work. Please enter the information manually. The PDF will still be attached to the listing.');
    return;
  }

  const r = parseScholarshipText(text);
  showAnnStatus('Done. Review the extracted details below before publishing.', 'ok');
  const html = '<strong>Please verify everything against the original PDF before publishing.</strong> ' +
    'The details below were extracted automatically and may be wrong or incomplete. Nothing is published until you click "Publish Scholarship".' +
    '<br><strong>Found:</strong> ' + (r.found.length ? esc(r.found.join(', ')) : 'nothing') + '.' +
    '<br><strong>Not found (left blank):</strong> ' + (r.missing.length ? esc(r.missing.join(', ')) : 'none') + '.' +
    (r.notes.length ? '<br><strong>Notes:</strong> ' + esc(r.notes.join(' ')) : '');
  openScholarshipForm(null, r.data, file, html);
}

// Admin page: summary cards, upload box and the list of all listings
function renderManage() {
  if (!isAdmin()) return;
  const published = scholarships.filter(function (s) { return s.published !== false; });
  const openCount = published.filter(function (s) { return !isClosed(s); }).length;
  $('admin-stats').innerHTML =
    statCard('Scholarship listings', scholarships.length, (scholarships.length - published.length) + ' unpublished', '') +
    statCard('Open for applications', openCount, 'published, deadline not passed', 'green') +
    statCard('Closed', published.length - openCount, 'deadline passed', '') +
    statCard('Submitted applications', applications.filter(function (a) { return a.status !== 'Draft'; }).length, 'from all students', 'gold');

  const sorted = scholarships.slice().sort(function (a, b) { return (a.deadline || '9').localeCompare(b.deadline || '9'); });
  if (sorted.length === 0) {
    $('sch-list').innerHTML = '<div class="card"><p>There are no scholarship listings yet.</p><p class="muted">Upload an announcement PDF above or click "Add Scholarship".</p></div>';
    return;
  }
  $('sch-list').innerHTML = sorted.map(function (s) {
    const isPub = s.published !== false;
    const appCount = applications.filter(function (a) { return a.scholarshipId === s.id && a.status !== 'Draft'; }).length;
    return '<div class="card app-card">' +
      '<div class="app-head"><div>' +
        '<div class="badges"><span class="badge badge-gray">' + esc(s.type || 'No type') + '</span>' +
        (isPub ? '<span class="badge badge-green">Published</span>' : '<span class="badge badge-amber">Unpublished draft</span>') + '</div>' +
        schHeadHTML(s) +
      '</div><div>' + deadlineBadge(s.deadline) + '</div></div>' +
      '<div class="app-meta">' +
        '<div><span>Deadline</span>' + formatDate(s.deadline) + '</div>' +
        '<div><span>Benefits</span>' + esc(s.benefits || '-') + '</div>' +
        '<div><span>Applications received</span>' + appCount + '</div>' +
      '</div>' +
      '<div class="card-actions">' +
        '<button class="btn btn-secondary btn-small" data-action="view" data-id="' + s.id + '">View Details</button>' +
        '<button class="btn btn-primary btn-small" data-action="admin-edit" data-id="' + s.id + '">Edit</button>' +
        '<button class="btn btn-secondary btn-small" data-action="sch-toggle" data-id="' + s.id + '">' + (isPub ? 'Unpublish' : 'Publish') + '</button>' +
        (s.announcement ? fileButtons(s.announcement).replace(/>Preview</g, '>View PDF<').replace(/>Download</g, '>Download PDF<') : '') +
        '<button class="btn btn-danger btn-small" data-action="sch-delete" data-id="' + s.id + '">Delete</button>' +
      '</div></div>';
  }).join('');
}

// ----- Admin: optional scholarship logo -----
let schLogoData = '';          // logo of the open form, as a small data URL ('' = none)
const LOGO_MAX_PX = 256;
const LOGO_MAX_MB = 5;

// Only renders images that are genuine PNG/JPEG data URLs
function logoHtml(s) {
  return s && s.logo && /^data:image\/(png|jpeg);base64,/.test(s.logo)
    ? '<img class="sch-logo" src="' + s.logo + '" alt="">' : '';
}

// Logo + name + provider, used on cards
function schHeadHTML(s) {
  return '<div class="sch-head">' + logoHtml(s) + '<div><h4 class="sch-title">' + esc(s.name) +
    '</h4><div class="sch-provider">' + esc(s.provider) + '</div></div></div>';
}

function showLogoPreview(dataUrl) {
  schLogoData = dataUrl || '';
  const prev = $('sch-logo-preview');
  const rm = $('sch-logo-remove');
  if (prev) {
    if (schLogoData) prev.src = schLogoData; else prev.removeAttribute('src');   // src="" can make browsers re-request the page
    prev.classList.toggle('hidden', !schLogoData);
  }
  if (rm) rm.classList.toggle('hidden', !schLogoData);
}

function handleLogoPicked(input) {
  const file = input.files && input.files[0];
  input.value = '';            // lets the same file be picked again later
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { showToast('Logo must be a PNG, JPG or WebP image.', 'error'); return; }
  if (file.size > LOGO_MAX_MB * 1024 * 1024) { showToast('Logo is larger than ' + LOGO_MAX_MB + ' MB.', 'error'); return; }

  const reader = new FileReader();
  reader.onerror = function () { showToast('Could not read that image.', 'error'); };
  reader.onload = function () {
    const img = new Image();
    img.onerror = function () { showToast('That file is not a valid image.', 'error'); };
    img.onload = function () {
      const scale = Math.min(1, LOGO_MAX_PX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      const ctx = c.getContext('2d');
      const jpeg = file.type === 'image/jpeg';
      if (jpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      showLogoPreview(c.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.85));   // PNG keeps transparency
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* =====================================================================
   8C. ADMIN - STUDENT APPLICATIONS (review and document verification)
   ===================================================================== */

const REVIEW_STATUSES = ['Submitted', 'Under Review', 'Verified', 'Incomplete', 'Approved', 'Rejected'];

function showSaDetail(show) {
  $('sa-list-view').classList.toggle('hidden', show);
  $('sa-detail-view').classList.toggle('hidden', !show);
  if (!show) reviewingAppId = null;
}

function renderStudentApps() {
  if (!isAdmin()) return;
  const status = val('sa-status');
  const search = val('sa-search').trim().toLowerCase();
  const all = applications.filter(function (a) { return a.status !== 'Draft'; });
  const list = all.filter(function (a) {
    if (status && a.status !== status) return false;
    if (search && !((a.name || '').toLowerCase().includes(search) || (a.studentEmail || '').toLowerCase().includes(search) || (a.scholarshipName || '').toLowerCase().includes(search))) return false;
    return true;
  }).sort(function (a, b) { return (b.submittedAt || '').localeCompare(a.submittedAt || '') || b.id - a.id; });

  $('sa-count').textContent = 'Showing ' + list.length + ' of ' + all.length + ' submitted application' + (all.length === 1 ? '' : 's') + '.';
  if (list.length === 0) {
    $('sa-table').innerHTML = '<div class="card"><p>No submitted applications to show.</p><p class="muted">Applications appear here after students submit them.</p></div>';
    return;
  }
  $('sa-table').innerHTML = '<div class="table-wrap"><table class="table"><thead><tr>' +
    '<th>Student</th><th>Email</th><th>Scholarship</th><th>Course and year</th><th>Date submitted</th><th>Status</th><th></th></tr></thead><tbody>' +
    list.map(function (a) {
      return '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.studentEmail) + '</td><td>' + esc(a.scholarshipName) + '</td>' +
        '<td>' + esc((a.course || '-') + (a.yearLevel ? ', ' + yearLabel(a.yearLevel) : '')) + '</td>' +
        '<td>' + formatDate(a.dateSubmitted) + '</td><td>' + statusBadge(a.status) + '</td>' +
        '<td><button class="btn btn-primary btn-small" data-action="review-open" data-id="' + a.id + '">Open</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function openAppReview(id) {
  const a = findApp(id);
  if (!a || !isAdmin()) return;
  reviewingAppId = id;
  const missing = a.documents.filter(function (d) { return !d.file; }).length;
  $('sa-detail').innerHTML =
    '<div class="card"><div class="app-head"><div><h3>' + esc(a.scholarshipName) + '</h3><div class="sch-provider">Application #' + a.id + '</div></div>' + statusBadge(a.status) + '</div>' +
    '<div class="app-meta">' +
      '<div><span>Student name</span>' + esc(a.name) + '</div>' +
      '<div><span>Email address</span>' + esc(a.studentEmail) + '</div>' +
      '<div><span>Student number</span>' + esc(a.studentNumber || '-') + '</div>' +
      '<div><span>Course and year</span>' + esc((a.course || '-') + (a.yearLevel ? ', ' + yearLabel(a.yearLevel) : '')) + '</div>' +
      '<div><span>GWA</span>' + esc(a.gwa) + '</div>' +
      '<div><span>Family income (as entered by the student)</span>' + (a.income === '' ? '-' : peso(a.income)) + '</div>' +
      '<div><span>Contact number</span>' + esc(a.contact || '-') + '</div>' +
      '<div><span>Date submitted</span>' + formatDate(a.dateSubmitted) + '</div>' +
    '</div>' +
    '<div class="detail-section"><h4>Statement</h4><p>' + esc(a.statement) + '</p></div></div>' +
    '<div class="card"><h3>Submitted requirements</h3>' +
      (missing ? '<div class="alert alert-warn">' + missing + ' requirement(s) have no file.</div>' : '<div class="alert alert-ok">All ' + a.documents.length + ' required documents were uploaded.</div>') +
      docsListHTML(a.documents) + '</div>' +
    '<div class="card"><h3>Review</h3><div class="form-grid">' +
      '<div class="field"><label for="rv-status">Application status</label><select id="rv-status">' +
        REVIEW_STATUSES.map(function (st) { return '<option value="' + st + '"' + (st === a.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></div>' +
      '<div class="field full' + (a.status === 'Incomplete' ? '' : ' hidden') + '" id="rv-remark-box"><label for="rv-remark">What is missing or incorrect? *</label>' +
        '<textarea id="rv-remark" rows="3" placeholder="e.g., Certificate of Registration is unreadable. Please re-upload.">' + esc(a.adminRemark || '') + '</textarea></div>' +
    '</div><div id="rv-error" class="alert alert-error hidden"></div>' +
    '<p class="muted">Students cannot edit a submitted application, even after a status change (prototype rule). Students see the new status and note on My Applications.</p>' +
    '<div class="card-actions"><button class="btn btn-primary" data-action="review-save">Save Status</button>' +
    '<button class="btn btn-ghost" data-action="review-back">Back to list</button></div></div>';
  showSaDetail(true);
  window.scrollTo(0, 0);
}

async function saveReview() {
  const a = findApp(reviewingAppId);
  if (!a || !isAdmin()) return;
  const status = val('rv-status');
  const remark = status === 'Incomplete' ? val('rv-remark').trim() : '';
  if (status === 'Incomplete' && !remark) {
    $('rv-error').textContent = 'Please explain what is missing or incorrect before marking the application as Incomplete.';
    $('rv-error').classList.remove('hidden');
    return;
  }
  a.status = status;
  a.adminRemark = remark;
  a.reviewedBy = currentUser.fullName;
  a.reviewedAt = new Date().toISOString();
  if (status === 'Approved') { if (a.disbursement.status === 'Not Yet Approved') a.disbursement.status = 'Pending'; }
  else a.disbursement.status = 'Not Yet Approved';

  if (!(await persistApp(a))) return;
  renderAll();
  showSaDetail(false);
  showToast('Status updated to "' + status + '". The student can now see it.');
}

/* =====================================================================
   9. NAVIGATION, MESSAGES, RESET
   ===================================================================== */

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  matching: 'Scholarship Matching',
  marketplace: 'Scholarship Marketplace',
  applications: 'My Applications',
  tracking: 'Tracking & Disbursement',
  manage: 'Manage Scholarships',
  studentapps: 'Student Applications'
};

function showPage(name) {
  if (!session) return;                          // nobody signed in
  if (!pageAllowed(name)) name = defaultPage();  // this role may not open that page
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  $('page-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.page === name);
  });
  $('page-title').textContent = PAGE_TITLES[name];

  showAppForm(false);        // always start on the application list
  showAppFlash('');
  editingAppId = null;
  showScholarshipForm(false);
  editingScholarshipId = null;
  pendingAnnouncement = null;
  showSaDetail(false);
  closeMenu();
  renderAll();
  window.scrollTo(0, 0);
  refreshData().then(renderAll);   // pick up changes made by other users
}

function toggleMenu() {
  $('sidebar').classList.toggle('open');
  $('backdrop').classList.toggle('show');
}
function closeMenu() {
  $('sidebar').classList.remove('open');
  $('backdrop').classList.remove('show');
}

function showToast(message, type) {
  const t = $('toast');
  t.textContent = message;
  t.className = 'toast ' + (type || 'success');   // also removes the "hidden" class
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3800);
}

// "Reset Demo Data" (admin only): clears scholarships and applications for EVERYONE. Accounts are kept.
async function resetDemoData() {
  if (!isAdmin()) return;
  if (!confirm('Reset demo data for ALL users?\n\nThis deletes every scholarship, student application and uploaded file in the shared database, then restores the sample scholarships. User accounts are kept.')) return;
  try {
    const apps = await store.list('applications');
    const schs = await store.list('scholarships');
    const paths = [];
    apps.forEach(function (a) { a.documents.forEach(function (d) { if (d.file) paths.push(d.file.path); }); });
    schs.forEach(function (s) { if (s.announcement) paths.push(s.announcement.path); });
    await store.removeFiles(paths);
    await Promise.all(apps.map(function (a) { return store.del('applications', a.id); }));
    await Promise.all(schs.map(function (s) { return store.del('scholarships', s.id); }));
    await Promise.all(getSampleScholarships().map(function (s) { return store.put('scholarships', s); }));
  } catch (e) { showToast('Reset failed: ' + (e.message || e), 'error'); return; }
  await refreshData();
  clearAnnouncementPicker();
  showPage('manage');
  showToast('Demo data has been reset.');
}


/* =====================================================================
   10. LISTENERS AND START-UP
   Buttons that are created by JavaScript use a data-action attribute.
   One listener on the whole page watches for clicks and calls the right function.
   ===================================================================== */

document.addEventListener('click', function (e) {
  // Click on the dark area outside a pop-up closes it
  if (e.target.id === 'modal') { closeModal(); return; }
  if (e.target.id === 'preview-modal') { closePreview(); return; }

  // "Remove logo" button in the scholarship form
  if (e.target.closest('#sch-logo-remove')) { showLogoPreview(''); return; }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = Number(el.dataset.id);

  switch (action) {
    case 'goto': showPage(el.dataset.page); break;
    case 'toggle-menu': toggleMenu(); break;
    case 'reset-data': resetDemoData(); break;
    case 'find-matches': handleFindMatches(); break;
    case 'clear-filters': clearFilters(); break;
    case 'view': openDetails(id); break;
    case 'close-modal': closeModal(); break;
    case 'close-preview': closePreview(); break;
    case 'apply': closeModal(); startApplication(id); break;
    case 'new-app': openNewAppForm(); break;
    case 'app-submit': saveApplication('submit'); break;
    case 'app-draft': saveApplication('draft'); break;
    case 'app-cancel': showAppForm(false); editingAppId = null; break;
    case 'edit-app': openEditForm(findApp(id)); break;
    case 'delete-app': deleteApplication(id); break;
    case 'doc-remove': formDocs[Number(el.dataset.index)].file = null; renderFormDocs(); break;
    case 'file-preview': previewStored(el); break;
    case 'file-download': downloadStored(el); break;
    case 'view-announcement': previewStored(el); break;
    case 'save-tracking': saveTracking(id, el.closest('.track-card')); break;
    // sign-in, accounts and admin
    case 'pick-role': pickRole(el.dataset.role); break;
    case 'reg-cancel': cancelRegistration(); break;
    case 'go-signup': showLoginError(''); showLoginStep('signup'); break;
    case 'go-signin': setBoxError('signup-error', ''); showLoginStep('signin'); break;
    case 'google-signin': signInWithGoogle(); break;
    case 'sign-out': signOut(); break;
    case 'admin-new': openScholarshipForm(); break;
    case 'admin-edit': closeModal(); showPage('manage'); openScholarshipForm(id); break;
    case 'sch-publish': saveScholarship(true); break;
    case 'sch-draft': saveScholarship(false); break;
    case 'sch-cancel': showScholarshipForm(false); editingScholarshipId = null; pendingAnnouncement = null; break;
    case 'sch-delete': deleteScholarship(id); break;
    case 'sch-toggle': toggleScholarship(id); break;
    case 'extract': extractAnnouncement(); break;
    case 'pending-pdf-view': if (pendingAnnouncement) showPreview(pendingAnnouncement, pendingAnnouncement.name, 'application/pdf'); break;
    case 'pending-pdf-download': if (pendingAnnouncement) downloadBlob(pendingAnnouncement, pendingAnnouncement.name, 'application/pdf'); break;
    case 'review-open': openAppReview(id); break;
    case 'review-back': showSaDetail(false); break;
    case 'review-save': saveReview(); break;
  }
});

// Dropdowns, checkboxes and file pickers created by JavaScript
document.addEventListener('change', function (e) {
  const el = e.target;
  if (el.dataset.action === 'doc-upload') handleDocUpload(el);
  if (el.id === 'ann-file') handleAnnouncementPicked(el);
  if (el.id === 'sch-logo') handleLogoPicked(el);   // scholarship logo file picker
  if (el.id === 'rv-status') $('rv-remark-box').classList.toggle('hidden', el.value !== 'Incomplete');
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { closeModal(); closePreview(); }
});

async function startApp() {
  // Fill the dropdown menus
  fillSelect('p-course', COURSES, 'Select your program');
  fillSelect('p-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }), 'Select year level');
  fillSelect('p-aid', AID_OPTIONS);
  fillSelect('p-interest', INTERESTS, 'Select a College');
  fillSelect('f-course', COURSES, 'All programs');
  fillSelect('f-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }), 'All year levels');
  fillSelect('f-type', TYPES, 'All types');
  fillSelect('af-course', COURSES, 'Select your program');
  fillSelect('af-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }), 'Select year level');
  fillSelect('reg-course', COURSES, 'Select your program');
  fillSelect('reg-year', YEARS.map(function (y) { return { value: y, label: yearLabel(y) }; }), 'Select year level');
  fillSelect('sa-status', REVIEW_STATUSES, 'All statuses');

  buildScholarshipFormChoices();

  // Forms: do not let the Enter key reload the page
  $('login-form').addEventListener('submit', function (e) { e.preventDefault(); handleSignIn(); });
  $('register-form').addEventListener('submit', function (e) { e.preventDefault(); handleRegister(); });
  $('signup-form').addEventListener('submit', function (e) { e.preventDefault(); handleSignUp(); });
  $('sch-form').addEventListener('submit', function (e) { e.preventDefault(); });
  $('app-form').addEventListener('submit', function (e) { e.preventDefault(); });
  $('profile-form').addEventListener('submit', function (e) { e.preventDefault(); handleSaveProfile(); });

  // Marketplace and Student Applications: update the list while typing and whenever a filter changes
  ['m-search', 'f-course', 'f-year', 'f-type', 'm-sort'].forEach(function (id) {
    $(id).addEventListener('input', renderMarketplace);
    $(id).addEventListener('change', renderMarketplace);
  });
  ['sa-status', 'sa-search'].forEach(function (id) {
    $(id).addEventListener('input', renderStudentApps);
    $(id).addEventListener('change', renderStudentApps);
  });

  // Application form: show the new upload rows when another scholarship is chosen
  $('af-scholarship').addEventListener('change', function () {
    if (editingAppId === null) { setDocsFromScholarship(); renderFormDocs(); }
  });

  $('storage-note').textContent = sb
    ? ''
    : 'LOCAL DEMO MODE: no cloud database is configured, so data is stored only in this browser and is NOT shared with other users. See README.';
  $('storage-note').classList.toggle('local', !sb);

  pickRole('student');
  showLoginStep('signin');
  showOAuthReturnError();

  // Restore the previous sign-in after a page refresh (this also picks up a return from Google sign-in)
  try {
    if (sb) {
      const cur = await sb.auth.getSession();
      const em = cur.data && cur.data.session && cur.data.session.user && cur.data.session.user.email;
      if (em) await finishAuthenticated(em.toLowerCase());
    } else {
      const saved = loadJSON(KEYS.session, null);
      if (saved && saved.email) {
        const user = await store.get('users', saved.email);
        if (user) { await completeSignIn(user, 'Welcome back, ' + user.fullName + '!'); }
        else saveJSON(KEYS.session, null);
      }
    }
  } catch (e) { showLoginError('Cannot reach the shared database: ' + (e.message || e)); }
  showSessionScreen();

  // Check for changes made by other users every 20 seconds
  setInterval(function () {
    if (!currentUser || document.hidden || saving) return;
    refreshData().then(renderAll);
  }, 20000);
}

startApp();