// Dental-specific content: treatment copy, the audit rules, the plan modules and the free toolkit.
// Everything here is written to stay factual — no "best dentist", no guaranteed results.

const SERVICES = [
  [/check|clean|scal|polish/i, 'sparkle', 'A thorough check-up, scaling and polishing — the short visit that prevents most dental problems.'],
  [/fill/i, 'tooth', 'Natural-looking fillings, matched to the shade of your own teeth.'],
  [/root|rct|endo/i, 'shield', 'Saves an infected tooth instead of removing it, with proper numbing and clear aftercare.'],
  [/crown|bridge|cap/i, 'crown', 'Natural-looking caps and bridges to restore broken or missing teeth.'],
  [/whiten|bleach/i, 'sparkle', 'Professional in-clinic whitening for a noticeably brighter smile, done safely.'],
  [/brace|align|ortho/i, 'align', 'Straighter teeth with metal or ceramic braces, or near-invisible clear aligners.'],
  [/implant/i, 'implant', 'A fixed, long-lasting replacement for a missing tooth that looks and feels natural.'],
  [/kid|child|paed|pedi/i, 'baby', 'Gentle, patient care that helps children feel at ease at the dentist.'],
  [/extract|wisdom|remov/i, 'tooth', 'Careful removal of damaged or wisdom teeth, with simple aftercare instructions.'],
  [/denture/i, 'smile', 'Comfortable full and partial dentures, made to fit you.'],
  [/gum|perio|bleed/i, 'drop', 'Treatment for bleeding gums and gum disease, before it affects your teeth.'],
  [/veneer|smile|cosmetic|design/i, 'smile', 'Veneers and smile makeovers, planned around your face and your goals.'],
];

export function service(s) {
  const name = typeof s === 'string' ? s : s.name;
  const match = SERVICES.find(([re]) => re.test(name));
  return {
    name,
    icon: (typeof s === 'object' && s.icon) || match?.[1] || 'tooth',
    desc: (typeof s === 'object' && s.desc) || match?.[2] || `Ask us about ${name.toLowerCase()} — we'll explain your options clearly.`,
  };
}

export const firstName = (c) => c.shortName || c.name;

export const hoursText = (c) => (c.hours || []).map((h) => `${h.days}: ${h.time}`).join(' · ');

export function clinicFaqs(c) {
  const base = [
    { q: 'How do I book an appointment?', a: `Tap "Book on WhatsApp" and send us a message with a day and time that suits you, or call ${c.phone}. We'll confirm your slot.` },
    { q: 'Where is the clinic?', a: `${c.address}. Tap "Get directions" for Google Maps.` },
    { q: 'What are your timings?', a: hoursText(c) || 'Message us on WhatsApp for current timings.' },
  ];
  return [...(c.faqs || []), ...base];
}

// ---------- Audit ----------
const item = (status, title, detail) => ({ status, title, detail });

export function audit(c) {
  const a = c.audit || {};
  const out = [];
  const comps = a.competitors || [];
  const top = comps.reduce((m, x) => (x.reviews > (m?.reviews ?? -1) ? x : m), null);

  if (c.rating != null) {
    out.push(c.rating >= 4.5
      ? item('good', `${c.rating}★ rating on Google`, 'Patients already rate you well. The opportunity is volume: more recent reviews so you rank higher for "dentist near me".')
      : item('warn', `${c.rating}★ rating on Google`, 'Many patients skip clinics below 4.5★. A steady flow of reviews from real patients usually lifts the average within a few months.'));
  }

  if (c.reviewCount != null) {
    if (top && top.reviews > c.reviewCount * 1.5) {
      out.push(item('bad', `${c.reviewCount} reviews vs ${top.reviews} at the busiest clinic nearby`, 'Google favours clinics with more — and more recent — reviews. Asking every patient after their visit, automatically, closes this gap.'));
    } else if (c.reviewCount < 100) {
      out.push(item('warn', `Only ${c.reviewCount} Google reviews`, 'Fewer than 100 reviews makes it hard to stand out on Maps. A simple ask after each visit changes this fast.'));
    } else {
      out.push(item('good', `${c.reviewCount} Google reviews`, 'A strong base. Keeping reviews recent matters as much as the total.'));
    }
  }

  if (a.website === 'none') out.push(item('bad', 'No website on your Google profile', 'Patients who find you on Maps can\'t see your treatments, doctors or timings — so they call the clinic that shows them. The preview we built fixes this.'));
  else if (a.website === 'outdated') out.push(item('warn', 'Website is outdated or hard to use on a phone', 'Most patients search on mobile. A slow or cluttered site sends them back to Google — and to the next clinic.'));
  else if (a.website === 'ok') out.push(item('good', 'Website is linked on Google', 'Good. The next step is making it book appointments, not just show information.'));

  if (a.onlineBooking === false) out.push(item('bad', 'Booking only by phone', 'Calls during treatment or lunch go unanswered. A WhatsApp booking button lets patients book at 11 pm — and you confirm in the morning.'));
  if (a.repliesToReviews === false) out.push(item('warn', 'Reviews aren\'t being replied to', 'Replies show new patients there\'s a caring person behind the clinic, and keep your profile active in Google\'s eyes.'));
  if (a.photoCount != null && a.photoCount < 20) out.push(item('warn', `Only ${a.photoCount} photos on your profile`, 'Real photos of the entrance, reception, treatment room and team build trust before the first visit. Aim for 25+.'));

  for (const n of a.notes || []) {
    out.push(typeof n === 'string' ? item('warn', n, '') : item(n.status || 'warn', n.title, n.detail || ''));
  }
  return out;
}

// ---------- The plan ----------
export function modules(c) {
  return [
    {
      icon: 'globe', title: 'A website that books patients',
      why: 'Turns Google searches into WhatsApp bookings instead of "I\'ll call later".',
      free: ['The full site design you just saw', `All the text, written for ${c.name}`],
      dfy: ['Live on your own domain, with hosting and SSL', 'Linked from your Google profile', 'Changes whenever you need them'],
    },
    {
      icon: 'pin', title: 'Google profile tune-up',
      why: 'Most new patients meet you on Google Maps before they ever call.',
      free: ['The 10-point checklist in this guide'],
      dfy: ['We make every change for you', 'Weekly Google posts and fresh photos'],
    },
    {
      icon: 'star', title: 'Review engine',
      why: 'More recent reviews means ranking higher for "dentist near me".',
      free: ['Review-request message', 'Reply templates for good and bad reviews'],
      dfy: ['An automatic review request after every visit', 'We draft a reply to every new review'],
    },
    {
      icon: 'chat', title: 'WhatsApp booking & reminders',
      why: 'Fewer missed calls, fewer no-shows.',
      free: ['Booking and reminder message templates'],
      dfy: ['WhatsApp Business set up properly (catalogue, quick replies, away message)', 'A reminder the day before every appointment'],
    },
    {
      icon: 'refresh', title: 'Recall & reactivation',
      why: 'Patients you\'ve already treated are your easiest next appointments.',
      free: ['The 6-month recall message'],
      dfy: ['We run recall campaigns from your patient list, every month'],
    },
    {
      icon: 'chart', title: 'Monthly scoreboard',
      why: 'See what\'s working in one page, not ten apps.',
      free: [],
      dfy: ['Profile views, calls, WhatsApp chats, bookings and reviews — every month'],
    },
  ];
}

export function toolkit(c) {
  const doc = c.doctors?.[0]?.name || `the team at ${c.name}`;
  const short = c.shortName || c.name;
  return [
    {
      title: 'Ask for a review (send the same day)',
      tip: 'Get your review link: Google Business Profile → "Ask for reviews". Send it to every patient, not just the happy ones — Google doesn\'t allow asking only for positive reviews. Also print it as a QR code for reception.',
      text: `Hi [Name], thank you for visiting ${short} today! Could you take a minute to share your experience on Google? Honest feedback helps other patients find the right dentist: [review link]\n\n— ${doc}`,
    },
    {
      title: 'Reply to a 5★ review',
      tip: 'Reply within 48 hours. Keep it short and personal.',
      text: `Thank you so much, [Name]! It was a pleasure seeing you. We look forward to your next check-up.\n— Team ${short}`,
    },
    {
      title: 'Reply to a critical review',
      tip: 'Never mention treatment details in public — patient privacy comes first. Move the conversation to a call.',
      text: `Hi [Name], we're sorry your visit didn't go the way you expected. We'd like to understand what happened and put it right — please call us on ${c.phone}.\n— ${doc}, ${c.name}`,
    },
    {
      title: 'WhatsApp quick reply for new enquiries',
      tip: 'Save it in WhatsApp Business → Tools → Quick replies, as "/book".',
      text: `Thanks for messaging ${c.name}! To book, please send:\n1) Your name\n2) What you need help with\n3) A day and time that suits you\n\nWe'll confirm your slot shortly.${c.hours?.length ? `\nTimings: ${hoursText(c)}` : ''}`,
    },
    {
      title: 'Appointment reminder (day before)',
      tip: 'Reminders the day before are the simplest way to cut no-shows.',
      text: `Hi [Name], a reminder of your appointment at ${c.name} tomorrow at [time].\nReply 1 to confirm or 2 to reschedule.\n📍 ${c.address}`,
    },
    {
      title: '6-month recall',
      tip: 'Send to every patient whose last visit was 6+ months ago. Ten messages a day is enough.',
      text: `Hi [Name], it's been about 6 months since your last visit to ${short} — time for your check-up and cleaning. Reply with a day that suits you and we'll find a slot.`,
    },
  ];
}

export const GBP_CHECKLIST = [
  ['Categories', 'Primary category "Dentist" or "Dental clinic". Add specialities only if you genuinely offer them (e.g. Orthodontist, Pediatric dentist).'],
  ['Services', 'List every treatment with a one-line description. Patients search for treatments, not just "dentist".'],
  ['Hours', 'Exact timings including the lunch break, plus special hours for festivals and holidays.'],
  ['Website & booking links', 'Website → your new site. Appointment link → your WhatsApp booking link.'],
  ['Photos', '25+ real photos: signboard and entrance (so people find the door), reception, treatment room, equipment, team.'],
  ['Description', 'Plain words: who you are, what you treat, where you are. Skip "best" and "No. 1" — keep it factual.'],
  ['Attributes', 'Fill in everything that applies: wheelchair access, payment options (UPI, cards), appointments required, etc.'],
  ['Weekly post', 'One short update a week: a dental tip, a new treatment, festival timings. It keeps the profile active.'],
  ['Review replies', 'Reply to every review within 48 hours — thank the good ones, take the bad ones offline.'],
  ['Consistency', 'Same clinic name, address and phone on Google, Practo, Justdial, Facebook and your website.'],
];
