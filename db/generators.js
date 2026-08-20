/**
 * Shared synthetic-data generator. Used by both db/seed.js (writes straight
 * into the database) and scripts/export-csv.js (writes CSV files you can
 * upload through the dashboard's Import page). Keeping the generation logic
 * in one place means both paths always produce the same realistic
 * conversion-funnel shape.
 */

const { v4: uuidv4 } = require("uuid");

// ---------- RNG helpers ----------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickWeighted(pairs) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [value, weight] of pairs) {
    if (r < weight) return value;
    r -= weight;
  }
  return pairs[pairs.length - 1][0];
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function maybe(prob) { return Math.random() < prob; }

function recentDate(maxDaysAgo, minDaysAgo = 0) {
  const skew = Math.pow(Math.random(), 1.6);
  const daysAgo = Math.floor(minDaysAgo + skew * (maxDaysAgo - minDaysAgo));
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randInt(8, 21), randInt(0, 59), randInt(0, 59));
  return d;
}
function toTimestamp(d) { return d.toISOString().slice(0, 19).replace("T", " "); }
function toDate(d) { return d.toISOString().slice(0, 10); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function titleCaseJs(s) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function fmtCr(n) { return n ? (n / 10000000).toFixed(1) + "Cr" : "?"; }

// ---------- reference data ----------
const MALE_FIRST = ["Ahmed", "Ali", "Usman", "Bilal", "Hamza", "Zeeshan", "Kashif", "Faisal", "Imran", "Waqas",
  "Asad", "Tariq", "Shahzad", "Adnan", "Farhan", "Rizwan", "Naveed", "Junaid", "Saad", "Umer",
  "Salman", "Kamran", "Sohail", "Aamir", "Nadeem", "Yasir", "Shoaib", "Zaman", "Fahad", "Haris"];
const FEMALE_FIRST = ["Ayesha", "Fatima", "Sana", "Amna", "Hira", "Mahnoor", "Sadia", "Rabia", "Nida", "Iqra",
  "Zara", "Sobia", "Maryam", "Komal", "Uzma", "Farah", "Bushra", "Saima", "Rida", "Anum",
  "Mehwish", "Sidra", "Noreen", "Shazia", "Tahira", "Asma", "Nazia", "Sundas", "Warda", "Laiba"];
const LAST = ["Khan", "Ahmed", "Malik", "Butt", "Chaudhry", "Sheikh", "Raza", "Iqbal", "Farooq", "Qureshi",
  "Hussain", "Abbasi", "Baig", "Gill", "Awan", "Mirza", "Siddiqui", "Rana", "Bhatti", "Cheema",
  "Javed", "Akhtar", "Anjum", "Warraich", "Dar", "Niazi", "Satti", "Zaidi", "Naqvi", "Soomro"];

const CITY_WEIGHTS = [
  ["Lahore", 30], ["Karachi", 25], ["Islamabad", 15], ["Rawalpindi", 10], ["Faisalabad", 6],
  ["Multan", 4], ["Peshawar", 4], ["Sialkot", 2], ["Gujranwala", 2], ["Bahawalpur", 1], ["Quetta", 1],
];

const SOCIETIES = {
  Lahore: ["DHA Lahore", "Bahria Town Lahore", "Gulberg", "Model Town", "Johar Town", "Wapda Town", "Askari 10", "Valencia Town"],
  Karachi: ["DHA Karachi", "Bahria Town Karachi", "Clifton", "Gulshan-e-Iqbal", "PECHS", "North Nazimabad", "Askari 5"],
  Islamabad: ["DHA Islamabad", "Bahria Town Islamabad", "G-10", "G-11", "F-10", "F-11", "Bani Gala"],
  Rawalpindi: ["Bahria Town Rawalpindi", "DHA Rawalpindi", "Askari 14", "Chaklala Scheme 3"],
  Faisalabad: ["Wapda City", "Madina Town", "Jinnah Colony"],
  Multan: ["Bosan Road", "Gulgasht Colony", "Model Town Multan"],
  Peshawar: ["Hayatabad", "University Town", "DHA Peshawar"],
  Sialkot: ["Cantt", "Model Town Sialkot"],
  Gujranwala: ["Model Town Gujranwala", "Satellite Town"],
  Bahawalpur: ["Model Town Bahawalpur", "Shadra Town"],
  Quetta: ["Cantt Quetta", "Jinnah Town Quetta"],
};

const CONTACT_TYPE_WEIGHTS = [
  ["buyer", 42], ["seller", 18], ["landlord", 10], ["tenant", 16], ["investor", 9], ["owner", 5],
];
const LEAD_SOURCE_WEIGHTS = [
  ["Zameen", 38], ["OLX", 18], ["Facebook", 14], ["WhatsApp", 14], ["Referral", 11], ["Walk-in", 5],
];
const PROPERTY_TYPE_WEIGHTS = [
  ["residential_plot", 30], ["house", 30], ["apartment", 15], ["commercial", 10], ["agricultural", 5], ["file", 10],
];
const SIZE_UNITS = ["Marla", "Kanal", "Sq Ft", "Sq Yd"];
const VERIFICATION_WEIGHTS = [
  ["not_verified", 30], ["fard_checked", 30], ["noc_verified", 20], ["registry_pending", 12], ["transfer_complete", 8],
];
const POSSESSION_WEIGHTS = [
  ["file_only", 20], ["under_development", 25], ["possession_ready", 40], ["constructed", 15],
];

// Realistic deal-stage funnel shape as PERCENTAGES of total deals (sums to 100).
// Same shape used at any scale, so the conversion-rate story stays consistent
// whether you generate 150 deals or 1,500.
const STAGE_PCT = [
  ["new_inquiry", 30], ["qualified", 20], ["site_visit_scheduled", 13.33], ["site_visit_done", 10],
  ["offer_made", 6], ["token_bayana_received", 4], ["due_diligence", 2.67], ["sale_agreement", 2],
  ["transfer_registry", 1.33], ["commission_received", 1], ["closed_won", 6.67], ["closed_lost", 3],
];
const TOKEN_STAGES = new Set(["token_bayana_received", "due_diligence", "sale_agreement", "transfer_registry"]);
const CLOSED_STAGES = new Set(["closed_won", "closed_lost", "commission_received"]);
const AGE_DAYS = {
  new_inquiry: [0, 20], qualified: [0, 35], site_visit_scheduled: [3, 45], site_visit_done: [5, 55],
  offer_made: [10, 70], token_bayana_received: [15, 90], due_diligence: [20, 100], sale_agreement: [25, 120],
  transfer_registry: [30, 150], commission_received: [40, 200], closed_won: [15, 365], closed_lost: [10, 300],
};

function randPhone() {
  const prefixes = ["300", "301", "302", "303", "310", "311", "320", "321", "333", "345"];
  return `03${pick(prefixes).slice(1)}${randInt(1000000, 9999999)}`;
}
function randCnic() { return `${randInt(10000, 99999)}-${randInt(1000000, 9999999)}-${randInt(1, 9)}`; }
function fullName() {
  const first = maybe(0.52) ? pick(MALE_FIRST) : pick(FEMALE_FIRST);
  return `${first} ${pick(LAST)}`;
}

function genContact() {
  const contact_type = pickWeighted(CONTACT_TYPE_WEIGHTS);
  const city = pickWeighted(CITY_WEIGHTS);
  const isSeekingBuyer = ["buyer", "tenant", "investor"].includes(contact_type);
  const created = recentDate(365);
  const budget_min = isSeekingBuyer ? randInt(30, 300) * 100000 : null;
  const budget_max = isSeekingBuyer ? budget_min + randInt(10, 150) * 100000 : null;
  return {
    id: uuidv4(),
    contact_type,
    name: fullName(),
    phone: randPhone(),
    whatsapp: maybe(0.85) ? randPhone() : null,
    email: null,
    cnic: maybe(0.6) ? randCnic() : null,
    city,
    address: null,
    budget_min,
    budget_max,
    preferred_areas: isSeekingBuyer ? pick(SOCIETIES[city]) : null,
    preferred_size_unit: isSeekingBuyer ? pick(SIZE_UNITS) : null,
    preferred_size_value: isSeekingBuyer ? randInt(3, 20) : null,
    purpose: isSeekingBuyer ? pick(["buy", "rent", "invest"]) : (contact_type === "seller" ? "sell" : null),
    lead_source: pickWeighted(LEAD_SOURCE_WEIGHTS),
    notes: null,
    created_at: toTimestamp(created),
  };
}

function genProperty(ownerContactId) {
  const property_type = pickWeighted(PROPERTY_TYPE_WEIGHTS);
  const purpose = maybe(0.78) ? "sale" : "rent";
  const city = pickWeighted(CITY_WEIGHTS);
  const society = pick(SOCIETIES[city]);
  const size_unit = property_type === "commercial" ? "Sq Ft" : pick(SIZE_UNITS);
  const size_value = size_unit === "Marla" ? randInt(3, 20) : size_unit === "Kanal" ? randInt(1, 4) : randInt(500, 4000);
  const priceScale = Math.pow(Math.random(), 1.8);
  const asking_price = purpose === "sale" ? Math.round((3000000 + priceScale * 57000000) / 50000) * 50000 : null;
  const rent_price = purpose === "rent" ? Math.round((20000 + priceScale * 280000) / 5000) * 5000 : null;
  const status = pickWeighted([["available", 65], ["token_taken", 10], ["sold", 15], ["rented", 7], ["suspended", 3]]);
  const created = recentDate(400);
  return {
    id: uuidv4(),
    property_type,
    purpose,
    size_unit,
    size_value,
    city,
    area: society,
    society,
    phase: maybe(0.6) ? `Phase ${randInt(1, 9)}` : null,
    block: maybe(0.6) ? pick(["A", "B", "C", "D", "E", "F", "G", "H"]) : null,
    plot_number: property_type !== "house" && property_type !== "apartment" ? String(randInt(1, 999)) : null,
    file_number: property_type === "file" ? `F-${randInt(10000, 99999)}` : null,
    file_type: property_type === "file" ? pick(["open", "closed", "ballot", "transfer"]) : null,
    payment_plan_status: property_type === "file" ? pick(["on schedule", "delayed", "completed"]) : null,
    transfer_fee_status: maybe(0.5) ? pick(["pending", "paid"]) : null,
    asking_price,
    rent_price,
    dc_rate: asking_price ? Math.round(asking_price * randFloat(0.5, 0.8) / 10000) * 10000 : null,
    market_rate: asking_price ? Math.round(asking_price * randFloat(0.95, 1.15) / 10000) * 10000 : null,
    development_charges_status: maybe(0.5) ? pick(["pending", "paid"]) : null,
    possession_status: pickWeighted(POSSESSION_WEIGHTS),
    verification_status: pickWeighted(VERIFICATION_WEIGHTS),
    description: null,
    image_urls: null,
    status,
    owner_contact_id: ownerContactId || null,
    created_at: toTimestamp(created),
  };
}

/**
 * Builds a full, internally-consistent dataset at any scale.
 * @param {object} opts
 * @param {number} opts.contactCount - base scale; everything else derives from this
 */
function buildDataset({ contactCount = 10000 } = {}) {
  const propertyCount = Math.round(contactCount * 0.3);
  const dealTotal = Math.round(contactCount * 0.15);

  // ---------- Contacts ----------
  const contacts = [];
  for (let i = 0; i < contactCount; i++) contacts.push(genContact());

  const buyerLikeContacts = contacts.filter((c) => ["buyer", "tenant", "investor"].includes(c.contact_type));
  const sellerLikeContacts = contacts.filter((c) => ["seller", "landlord", "owner"].includes(c.contact_type));

  // ---------- Properties ----------
  const properties = [];
  for (let i = 0; i < propertyCount; i++) {
    const owner = maybe(0.6) && sellerLikeContacts.length ? pick(sellerLikeContacts).id : null;
    properties.push(genProperty(owner));
  }

  // ---------- Leads (~85% of buyer-like contacts) ----------
  const leadCandidates = buyerLikeContacts.filter(() => maybe(0.85));
  const leads = leadCandidates.map((c) => {
    const status = pickWeighted([["new", 45], ["qualified", 30], ["unqualified", 15], ["converted", 10]]);
    const scoreRange = { new: [20, 50], qualified: [50, 85], unqualified: [0, 30], converted: [70, 100] }[status];
    return {
      id: uuidv4(),
      contact_id: c.id,
      status,
      requirements: `${c.preferred_size_value || randInt(5, 12)} ${c.preferred_size_unit || "Marla"} ${pick(["house", "plot", "apartment"])} in ${c.preferred_areas || "DHA"}, budget ${fmtCr(c.budget_min)}-${fmtCr(c.budget_max)}`,
      lead_score: randInt(scoreRange[0], scoreRange[1]),
      created_at: c.created_at,
      _status: status,
    };
  });

  // ---------- Deals ----------
  const qualifiedPool = leads.filter((l) => l._status === "qualified" || l._status === "converted");
  const otherPool = leads.filter((l) => l._status === "new" || l._status === "unqualified");
  shuffle(qualifiedPool);
  shuffle(otherPool);
  const primaryShare = Math.round(dealTotal * 0.8);
  const secondaryShare = dealTotal - primaryShare;
  const dealLeads = [...qualifiedPool.slice(0, primaryShare), ...otherPool.slice(0, secondaryShare)];
  while (dealLeads.length < dealTotal && leads.length) dealLeads.push(pick(leads)); // pad if pools too small

  // Build stage sequence from percentages, fixing rounding so it sums exactly to dealTotal
  let stageCounts = STAGE_PCT.map(([stage, pct]) => [stage, Math.round((pct / 100) * dealTotal)]);
  let diff = dealTotal - stageCounts.reduce((s, [, c]) => s + c, 0);
  stageCounts[0][1] += diff; // adjust largest bucket (new_inquiry) to absorb rounding
  if (stageCounts[0][1] < 0) stageCounts[0][1] = 0;

  const stageSequence = [];
  stageCounts.forEach(([stage, count]) => { for (let i = 0; i < count; i++) stageSequence.push(stage); });
  shuffle(stageSequence);

  const deals = [];
  const financials = [];
  const tasks = [];

  for (let i = 0; i < stageSequence.length; i++) {
    const lead = dealLeads[i % Math.max(dealLeads.length, 1)];
    const buyerContact = lead ? contacts.find((c) => c.id === lead.contact_id) : null;
    const property = properties.length ? pick(properties) : null;
    const seller = property && property.owner_contact_id
      ? { id: property.owner_contact_id }
      : (sellerLikeContacts.length && maybe(0.7) ? pick(sellerLikeContacts) : null);
    const stage = stageSequence[i];
    const [minAge, maxAge] = AGE_DAYS[stage];
    const created = recentDate(maxAge, minAge);
    const commission_percentage = 2;
    const basePrice = (property && (property.asking_price || (property.rent_price ? property.rent_price * 12 : null))) || 5000000;
    const commission_amount = CLOSED_STAGES.has(stage) || TOKEN_STAGES.has(stage) ? Math.round(basePrice * commission_percentage / 100 / 1000) * 1000 : null;
    const token_amount = TOKEN_STAGES.has(stage) || CLOSED_STAGES.has(stage) ? Math.round(basePrice * randFloat(0.05, 0.12) / 10000) * 10000 : null;
    const token_date = token_amount ? toDate(recentDate(maxAge, Math.max(0, minAge - 5))) : null;
    let actual_close_date = null;
    if (stage === "closed_won" || stage === "closed_lost" || stage === "commission_received") {
      actual_close_date = toDate(created);
    }
    const deal = {
      id: uuidv4(),
      property_id: property ? property.id : null,
      buyer_contact_id: buyerContact ? buyerContact.id : null,
      seller_contact_id: seller ? seller.id : null,
      deal_type: property && property.purpose === "rent" ? "rent" : "sale",
      stage,
      token_amount,
      token_date,
      commission_percentage,
      commission_amount,
      expected_close_date: toDate(recentDate(30, -30)),
      actual_close_date,
      notes: null,
      created_at: toTimestamp(created),
    };
    deals.push(deal);

    if (stage === "closed_won" || stage === "commission_received") {
      financials.push({
        id: uuidv4(), entry_type: "income", category: "commission",
        amount: commission_amount, deal_id: deal.id,
        description: `Commission - ${(property && property.society) || "deal"}`,
        entry_date: actual_close_date,
      });
    }
    if (TOKEN_STAGES.has(stage) && stage !== "transfer_registry") {
      financials.push({
        id: uuidv4(), entry_type: "token_held", category: "other",
        amount: token_amount, deal_id: deal.id,
        description: `Token/bayana held - ${(property && property.society) || "deal"}`,
        entry_date: token_date,
      });
    }

    if (!CLOSED_STAGES.has(stage) && maybe(0.55)) {
      const dueOffset = randInt(-5, 12);
      const due = new Date(); due.setDate(due.getDate() + dueOffset);
      const taskTitleByStage = {
        new_inquiry: "Call back to qualify inquiry",
        qualified: "Send shortlisted property options",
        site_visit_scheduled: "Site visit",
        site_visit_done: "Follow up after site visit",
        offer_made: "Follow up on offer",
        token_bayana_received: "Prepare token receipt & witness docs",
        due_diligence: "Verify Fard / NOC with society office",
        sale_agreement: "Draft sale agreement",
        transfer_registry: "Accompany client to transfer office",
      };
      tasks.push({
        id: uuidv4(),
        title: taskTitleByStage[stage] || "Follow up",
        description: null,
        due_date: toTimestamp(due),
        status: dueOffset < -1 ? "pending" : pickWeighted([["pending", 70], ["in_progress", 30]]),
        priority: pickWeighted([["urgent", 10], ["high", 30], ["medium", 45], ["low", 15]]),
        related_type: "deal",
        related_id: deal.id,
        created_at: deal.created_at,
      });
    }
  }

  // General follow-up tasks for fresh leads not yet in the deal pipeline
  const freshLeads = leads.filter((l) => l._status === "new").slice(0, Math.round(contactCount * 0.04));
  freshLeads.forEach((l) => {
    if (!maybe(0.4)) return;
    const dueOffset = randInt(-3, 10);
    const due = new Date(); due.setDate(due.getDate() + dueOffset);
    tasks.push({
      id: uuidv4(),
      title: "Call back new lead",
      description: null,
      due_date: toTimestamp(due),
      status: "pending",
      priority: pickWeighted([["urgent", 15], ["high", 25], ["medium", 45], ["low", 15]]),
      related_type: "contact",
      related_id: l.contact_id,
      created_at: l.created_at,
    });
  });

  // Marketing/fuel/other expenses spread across the year
  const expenseCategories = [["marketing", 55], ["fuel", 35], ["other", 10]];
  const expenseCount = Math.round(contactCount * 0.026);
  for (let i = 0; i < expenseCount; i++) {
    const category = pickWeighted(expenseCategories);
    const amount = category === "marketing" ? randInt(2000, 40000) : category === "fuel" ? randInt(1000, 8000) : randInt(500, 15000);
    const date = recentDate(365);
    financials.push({
      id: uuidv4(), entry_type: "expense", category, amount, deal_id: null,
      description: category === "marketing" ? pick(["Zameen featured listing", "Facebook ad boost", "Signboard printing", "Property photography"])
        : category === "fuel" ? "Site visit fuel" : "Misc office expense",
      entry_date: toDate(date),
    });
  }

  // Strip internal-only fields before handing back
  const cleanLeads = leads.map(({ _status, ...rest }) => rest);

  return { contacts, properties, leads: cleanLeads, deals, tasks, financials };
}

module.exports = { buildDataset, titleCaseJs };
